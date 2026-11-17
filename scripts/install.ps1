<#
.SYNOPSIS
Instala o actualiza DevFlow CLI en Windows.

.DESCRIPTION
Comprueba los requisitos (Node.js 22.13 o superior, Git y, como aviso, Ollama con el modelo qwen2.5:3b).
Es compatible con Windows PowerShell 5.1 y PowerShell 7. El archivo se guarda en UTF-8 con BOM para que
Windows PowerShell 5.1 lea bien las tildes.

.PARAMETER Rama
Rama del repositorio que se instala.

.PARAMETER Carpeta
Carpeta donde se clona el repositorio.

.PARAMETER Repositorio
URL del repositorio.

.PARAMETER OllamaHost
Dirección de Ollama.
#>
[CmdletBinding()]
param(
    [string]$Rama = 'final-project-ANR',
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'DevFlowCLI\app'),
    [string]$Repositorio = 'https://github.com/andrearocha-git/AI4Devs-finalproject.git',
    [string]$OllamaHost = 'http://localhost:11434'
)

$VersionMinimaNode = [version]'22.13.0'
$ModeloOllama = 'qwen2.5:3b'

function Get-ResultadoRequisitos {
    <#
    .SYNOPSIS
    Decide qué requisitos faltan, sin consultar el equipo.
    .PARAMETER NodeVersion
    Versión de Node.js (por ejemplo 24.22.2), o vacío si no está instalado.
    .PARAMETER GitDisponible
    Si Git está en el PATH.
    .PARAMETER OllamaModelos
    Nombres de los modelos que informa Ollama, o $null si no responde.
    .OUTPUTS
    Objeto con Bloqueantes (impiden instalar) y Avisos (no impiden instalar).
    #>
    [CmdletBinding()]
    param(
        [AllowNull()][AllowEmptyString()][string]$NodeVersion,
        [bool]$GitDisponible,
        [AllowNull()][string[]]$OllamaModelos
    )
    $bloqueantes = @()
    $avisos = @()

    if ([string]::IsNullOrWhiteSpace($NodeVersion)) {
        $bloqueantes += "No se encontró Node.js. Instala la versión $VersionMinimaNode o superior desde https://nodejs.org y abre una terminal nueva."
    }
    elseif ([version]$NodeVersion -lt $VersionMinimaNode) {
        $bloqueantes += "Node.js $NodeVersion es anterior a la versión mínima $($VersionMinimaNode.ToString(2)). Actualiza Node.js desde https://nodejs.org."
    }

    if (-not $GitDisponible) {
        $bloqueantes += 'No se encontró Git en el PATH. Instálalo desde https://git-scm.com y abre una terminal nueva.'
    }

    if ($null -eq $OllamaModelos) {
        $avisos += "Ollama no responde. Inícialo antes de usar 'devflow start'; sin él, el documento se genera sin la Fase 1 de la IA."
    }
    elseif (-not ($OllamaModelos | Where-Object { $_ -like "$ModeloOllama*" })) {
        $avisos += "Ollama no tiene el modelo $ModeloOllama. Descárgalo con: ollama pull $ModeloOllama"
    }

    [pscustomobject]@{ Bloqueantes = @($bloqueantes); Avisos = @($avisos) }
}

function Get-RequisitosDelEquipo {
    <#
    .SYNOPSIS
    Consulta Node.js, Git y Ollama en este equipo y devuelve el resultado de Get-ResultadoRequisitos.
    #>
    $nodeVersion = $null
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = ((& node --version) -replace '^v', '').Trim()
    }
    $git = [bool](Get-Command git -ErrorAction SilentlyContinue)
    $modelos = $null
    try {
        $respuesta = Invoke-RestMethod -Uri "$OllamaHost/api/tags" -TimeoutSec 3
        $modelos = @($respuesta.models | ForEach-Object { $_.name })
    }
    catch {
        $modelos = $null
    }
    Get-ResultadoRequisitos -NodeVersion $nodeVersion -GitDisponible $git -OllamaModelos $modelos
}

function Get-EstadoInstalacion {
    <#
    .SYNOPSIS
    Decide en qué estado está la instalación existente, sin modificar nada salvo las referencias remotas (git fetch).
    .PARAMETER Carpeta
    Carpeta donde debería estar el clon.
    .OUTPUTS
    NoInstalado (no hay clon), CambiosLocales (archivos seguidos modificados), AlDia (nada que traer y ya compilado; los
    commits locales sin publicar y los archivos sin seguimiento no cuentan), SinCompilar (nada que traer, pero falta
    dist/tui/cli.js porque una compilación o el npm link fallaron antes), ConNovedades (origin tiene commits nuevos y se
    puede avanzar) o Divergido (la rama local y origin tienen commits distintos).
    .NOTES
    Lanza una excepción si no se puede consultar origin.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Carpeta)

    if (-not (Test-Path -LiteralPath (Join-Path $Carpeta '.git'))) { return 'NoInstalado' }

    $pendientes = & git -C $Carpeta status --porcelain --untracked-files=no
    if ($pendientes) { return 'CambiosLocales' }

    & git -C $Carpeta fetch --quiet origin
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar origin (git fetch falló). Comprueba la conexión y el acceso al repositorio.' }
    $conteo = (& git -C $Carpeta rev-list --left-right --count 'HEAD...@{u}') -split '\s+'
    if ($LASTEXITCODE -ne 0) { throw 'La rama del clon no sigue a ninguna rama de origin.' }

    $adelante = [int]$conteo[0]
    $atras = [int]$conteo[1]
    if ($atras -eq 0) {
        if (-not (Test-Path -LiteralPath (Join-Path $Carpeta 'dist/tui/cli.js'))) { return 'SinCompilar' }
        return 'AlDia'
    }
    if ($adelante -eq 0) { return 'ConNovedades' }
    return 'Divergido'
}

function Get-VersionInstalada {
    <#
    .SYNOPSIS
    Lee la versión de DevFlow CLI del package.json del clon.
    #>
    param([Parameter(Mandatory)][string]$Carpeta)
    (Get-Content -Raw -LiteralPath (Join-Path $Carpeta 'package.json') | ConvertFrom-Json).version
}

function Invoke-Paso {
    <#
    .SYNOPSIS
    Ejecuta un comando externo y lanza una excepción si termina con error.
    #>
    param([string]$Texto, [scriptblock]$Bloque)
    Write-Host "-> $Texto"
    & $Bloque
    if ($LASTEXITCODE -ne 0) { throw "Falló el paso: $Texto" }
}

function Restore-LockfileTrasNpm {
    <#
    .SYNOPSIS
    Deja package-lock.json como está en el repositorio.
    .DESCRIPTION
    Según la versión de npm, `npm install` reescribe package-lock.json, y el clon quedaría con «cambios locales» que
    bloquearían la siguiente actualización. Solo se llama justo después de `npm install`, cuando el clon estaba limpio
    (clon nuevo, o estado comprobado con Get-EstadoInstalacion), así que lo único que cambió ese archivo es npm.
    Si el repositorio no tiene package-lock.json, no hace nada.
    #>
    param([Parameter(Mandatory)][string]$Carpeta)
    & git -C $Carpeta ls-files --error-unmatch package-lock.json 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { & git -C $Carpeta checkout -- package-lock.json }
}

function Clear-Dist {
    <#
    .SYNOPSIS
    Borra dist/ antes de compilar una actualización, para que, si la compilación falla, la siguiente ejecución vea el clon
    como SinCompilar y la reintente en vez de dar por buena una compilación vieja.
    #>
    param([Parameter(Mandatory)][string]$Carpeta)
    $dist = Join-Path $Carpeta 'dist'
    if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
}

function Build-DevFlow {
    <#
    .SYNOPSIS
    Instala las dependencias y compila; con -Enlazar crea además el comando global devflow (npm link).
    #>
    param([Parameter(Mandatory)][string]$Carpeta, [switch]$Enlazar)
    Push-Location $Carpeta
    try {
        Invoke-Paso 'npm install' { npm install }
        Restore-LockfileTrasNpm -Carpeta $Carpeta
        Invoke-Paso 'npm run build' { npm run build }
        if ($Enlazar) { Invoke-Paso 'npm link' { npm link } }
    }
    finally { Pop-Location }
}

function Start-Instalacion {
    <#
    .SYNOPSIS
    Flujo principal: comprueba los requisitos y, según el estado del clon, instala, actualiza o se detiene.
    #>
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    try {
        $requisitos = Get-RequisitosDelEquipo
        foreach ($aviso in $requisitos.Avisos) { Write-Host "AVISO: $aviso" -ForegroundColor Yellow }
        if ($requisitos.Bloqueantes.Count -gt 0) {
            foreach ($bloqueante in $requisitos.Bloqueantes) { Write-Host "ERROR: $bloqueante" -ForegroundColor Red }
            exit 1
        }

        switch (Get-EstadoInstalacion -Carpeta $Carpeta) {
            'NoInstalado' {
                Invoke-Paso "git clone ($Rama)" { git clone --branch $Rama $Repositorio $Carpeta }
                Build-DevFlow -Carpeta $Carpeta -Enlazar
                if (-not (Get-Command devflow -ErrorAction SilentlyContinue)) {
                    Write-Host "AVISO: el comando devflow aún no se reconoce. Abre una terminal nueva; si sigue igual, revisa que $(npm prefix -g) esté en el PATH." -ForegroundColor Yellow
                }
                else { Invoke-Paso 'devflow --help' { devflow --help | Out-Null } }
                Write-Host "DevFlow CLI $(Get-VersionInstalada $Carpeta) instalado en $Carpeta. Siguiente paso: devflow config" -ForegroundColor Green
            }
            'AlDia' {
                Write-Host "DevFlow CLI ya está al día (versión $(Get-VersionInstalada $Carpeta)) en $Carpeta. No se cambió nada." -ForegroundColor Green
            }
            'SinCompilar' {
                Write-Host 'El clon está al día pero sin compilar (una instalación anterior no terminó): se completa ahora.'
                Build-DevFlow -Carpeta $Carpeta -Enlazar
                if (-not (Get-Command devflow -ErrorAction SilentlyContinue)) {
                    Write-Host "AVISO: el comando devflow aún no se reconoce. Abre una terminal nueva; si sigue igual, revisa que $(npm prefix -g) esté en el PATH." -ForegroundColor Yellow
                }
                else { Invoke-Paso 'devflow --help' { devflow --help | Out-Null } }
                Write-Host "DevFlow CLI $(Get-VersionInstalada $Carpeta) instalado en $Carpeta. Siguiente paso: devflow config" -ForegroundColor Green
            }
            'ConNovedades' {
                Invoke-Paso 'git pull --ff-only' { git -C $Carpeta pull --ff-only --quiet }
                Clear-Dist -Carpeta $Carpeta
                Build-DevFlow -Carpeta $Carpeta
                Write-Host "DevFlow CLI actualizado a la versión $(Get-VersionInstalada $Carpeta)." -ForegroundColor Green
            }
            'CambiosLocales' {
                Write-Host "ERROR: el clon en $Carpeta tiene cambios locales sin guardar (git status). No se tocó nada: guárdalos o descártalos y vuelve a ejecutar el instalador." -ForegroundColor Red
                exit 1
            }
            'Divergido' {
                Write-Host "ERROR: la rama local de $Carpeta diverge de origin (tiene commits que origin no tiene y al revés), así que no se puede actualizar sin pisar nada. No se tocó nada: resuélvelo con git." -ForegroundColor Red
                exit 1
            }
        }
    }
    catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Al cargar el archivo con `. .\install.ps1` (para probar las funciones) no se ejecuta el flujo principal.
if ($MyInvocation.InvocationName -ne '.') {
    Start-Instalacion
}
