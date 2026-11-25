param(
    [switch]$DatabaseOnly,
    [string]$Project
)

$ErrorActionPreference = 'Stop'
$runtime = Join-Path $PSScriptRoot '.local-mysql'
$mysqlHome = Join-Path $runtime 'mysql-8.4.13-winx64'
$data = Join-Path $runtime 'data'
$dump = Join-Path $PSScriptRoot 'tickets.sql.gz'
$port = 3307
$server = Join-Path $mysqlHome 'bin\mysqld.exe'
$client = Join-Path $mysqlHome 'bin\mysql.exe'
$log = Join-Path $runtime 'mysql.err'

function Confirm-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit code $LASTEXITCODE)." }
}

function Initialize-MySql {
    if (Test-Path -LiteralPath $server) { return }
    $zip = Join-Path $runtime 'mysql-8.4.13-winx64.zip'
    if (!(Test-Path -LiteralPath $zip)) {
        Write-Host 'Downloading portable MySQL 8.4...'
        & curl.exe --fail --silent --show-error --location --output "$zip.part" 'https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip'
        Confirm-Exit 'MySQL download'
        if ((Get-FileHash -LiteralPath "$zip.part" -Algorithm MD5).Hash -ne '7b94489d5524dea9b27097068bea25a8') {
            throw 'MySQL download checksum mismatch.'
        }
        Move-Item -LiteralPath "$zip.part" -Destination $zip
    }
    Write-Host 'Extracting MySQL...'
    & tar.exe -xf $zip -C $runtime
    Confirm-Exit 'MySQL extraction'
}

function Copy-HandoffFiles {
    & robocopy.exe (Join-Path $PSScriptRoot 'user') (Join-Path $Project 'user') /E /XC /XN /XO /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) { throw 'Copying the handoff user files failed.' }
}

try {
    if (!$databaseOnly) {
        if (!$Project) {
            if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'scripts\postinstall.js')) {
                $Project = $PSScriptRoot
            } else {
                $Project = Join-Path $PSScriptRoot '..\ezz-ticket-bot-main\ezz-ticket-bot-main'
            }
        }
        $Project = (Resolve-Path -LiteralPath $Project).Path
        if (!(Test-Path -LiteralPath (Join-Path $Project 'scripts\postinstall.js'))) {
            throw 'Pass the path to the ticket bot checkout as the first argument.'
        }
        Get-Command node.exe,npm.cmd -ErrorAction Stop | Out-Null
    }

    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $lock = [IO.File]::Open((Join-Path $runtime 'startup.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    Initialize-MySql
    $credentials = Join-Path $runtime 'credentials.json'
    $options = Join-Path $runtime 'client.ini'
    $init = Join-Path $runtime 'initialize.sql'
    $restored = Join-Path $runtime 'restore.complete'
    $restoreStarted = Join-Path $runtime 'restore.started'

    if (!(Test-Path -LiteralPath $credentials)) {
        if (Test-Path -LiteralPath $data) { throw 'MySQL data exists but its local credentials are missing.' }
        @{
            root = [guid]::NewGuid().ToString('N')
            bot = [guid]::NewGuid().ToString('N')
        } | ConvertTo-Json | Set-Content -LiteralPath $credentials -Encoding ASCII
    }
    $passwords = Get-Content -LiteralPath $credentials -Raw | ConvertFrom-Json
    @"
[client]
protocol=tcp
host=127.0.0.1
port=$port
user=root
password=$($passwords.root)
"@ | Set-Content -LiteralPath $options -Encoding ASCII

    if (!(Test-Path -LiteralPath (Join-Path $data 'mysql'))) {
        Write-Host 'Initializing the local MySQL data directory...'
        & $server --no-defaults --initialize-insecure "--basedir=$mysqlHome" "--datadir=$data" "--log-error=$log"
        Confirm-Exit "MySQL initialization. See $log"
    }

    function Test-MySql {
        $ErrorActionPreference = 'Continue'
        & $client "--defaults-file=$options" --connect-timeout=2 --execute='SELECT 1' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    }

    if (!(Test-MySql)) {
        $argsList = @('--no-defaults', ('"--basedir={0}"' -f $mysqlHome), ('"--datadir={0}"' -f $data),
            ('"--log-error={0}"' -f $log), '--bind-address=127.0.0.1', "--port=$port", '--mysqlx=OFF')
        if (!(Test-Path -LiteralPath $restored)) {
            @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$($passwords.root)';
CREATE DATABASE IF NOT EXISTS tickets CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'ticket_bot'@'localhost' IDENTIFIED BY '$($passwords.bot)';
GRANT ALL PRIVILEGES ON tickets.* TO 'ticket_bot'@'localhost';
"@ | Set-Content -LiteralPath $init -Encoding ASCII
            $argsList += ('"--init-file={0}"' -f $init)
        }
        Write-Host "Starting MySQL on 127.0.0.1:$port..."
        $process = Start-Process -FilePath $server -ArgumentList $argsList -WindowStyle Hidden -PassThru
        $deadline = (Get-Date).AddSeconds(60)
        while (!(Test-MySql)) {
            if ($process.HasExited -or (Get-Date) -ge $deadline) {
                throw "MySQL did not start. Check whether port $port is free and see $log."
            }
            Start-Sleep -Milliseconds 500
        }
    }
    if (Test-Path -LiteralPath $init) { Remove-Item -LiteralPath $init }

    if (!(Test-Path -LiteralPath $restored)) {
        if (Test-Path -LiteralPath $restoreStarted) {
            throw "A previous restore was interrupted. Review the private database in $data before retrying."
        }
        if (!(Test-Path -LiteralPath $dump)) { throw 'tickets.sql.gz is missing.' }
        New-Item -ItemType File -Path $restoreStarted | Out-Null
        Write-Host 'Restoring the ticket database. This runs once...'
        $import = New-Object Diagnostics.ProcessStartInfo
        $import.FileName = $client
        $import.Arguments = ('--defaults-file="{0}" --binary-mode --default-character-set=utf8mb4 tickets' -f $options)
        $import.UseShellExecute = $false
        $import.RedirectStandardInput = $true
        $inputFile = [IO.File]::OpenRead($dump)
        try {
            $gzip = New-Object IO.Compression.GZipStream($inputFile, [IO.Compression.CompressionMode]::Decompress)
            try {
                $restore = [Diagnostics.Process]::Start($import)
                try {
                    $gzip.CopyTo($restore.StandardInput.BaseStream)
                    $restore.StandardInput.Close()
                    $restore.WaitForExit()
                    if ($restore.ExitCode -ne 0) { throw 'MySQL rejected the import.' }
                } finally { $restore.Dispose() }
            } finally { $gzip.Dispose() }
        } finally { $inputFile.Dispose() }

        $counts = & $client "--defaults-file=$options" --batch --skip-column-names tickets '--execute=SELECT COUNT(*) FROM tickets UNION ALL SELECT COUNT(*) FROM archivedMessages'
        Confirm-Exit 'Checking restored rows'
        if (($counts -join ',') -ne '3353,107260') { throw 'Restore row counts differ from the handoff.' }
        Move-Item -LiteralPath $restoreStarted -Destination $restored
        Write-Host 'Verified 3,353 tickets and 107,260 archived messages.'
    }
    Write-Host "MySQL is ready on 127.0.0.1:$port."
    if ($databaseOnly) { exit 0 }

    if ($Project -ne $PSScriptRoot) { Copy-HandoffFiles }
    Set-Location -LiteralPath $Project
    if (!(Test-Path -LiteralPath 'node_modules\.package-lock.json')) {
        & npm.cmd ci --omit=dev --ignore-scripts
        Confirm-Exit 'Installing bot dependencies'
    }

    $config = & node.exe -e "process.stdout.write(JSON.stringify(require('dotenv').parse(require('fs').readFileSync(process.argv[1]))))" (Join-Path $PSScriptRoot '.env')
    Confirm-Exit 'Reading the handoff environment'
    $config = $config | ConvertFrom-Json
    foreach ($entry in $config.PSObject.Properties) {
        [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process')
    }
    $env:DB_PROVIDER = 'mysql'
    $env:DB_CONNECTION_URL = "mysql://ticket_bot:$($passwords.bot)@127.0.0.1:$port/tickets"

    & node.exe -e "require('./src/env').load()"
    Confirm-Exit 'Validating the bot environment'
    & node.exe scripts/postinstall
    Confirm-Exit 'Applying database migrations'
    & npm.cmd start
    Confirm-Exit 'Running the bot'
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
