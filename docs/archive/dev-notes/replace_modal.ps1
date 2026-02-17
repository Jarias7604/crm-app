# Script PowerShell para reemplazar el modal con fullscreen

$file = "c:\Users\jaria\OneDrive\DELL\Desktop\crm-app\src\pages\Leads.tsx"
$content = Get-Content $file -Raw

# Buscar el patrón de inicio
$start = $content.IndexOf('            {/* Create Lead Modal - Modern Professional Design */')
# Buscar el patrón de fin  
$end = $content.IndexOf('            </Modal>', $start) + '            </Modal>'.Length

if ($start -ge 0 -and $end -gt $start) {
    # Extraer antes y después
    $before = $content.Substring(0, $start)
    $after = $content.Substring($end)
    
    # Nuevo contenido
    $newContent = @"
            {/* Create Lead Fullscreen */}
            <CreateLeadFullscreen
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                formData={formData}
                setFormData={setFormData}
                teamMembers={teamMembers}
                onSubmit={handleSubmit}
            />
"@
    
    # Combinar
    $finalContent = $before + $newContent + $after
    
    # Guardar
    Set-Content -Path $file -Value $finalContent -NoNewline
    
    Write-Host "✅ Modal reemplazado exitosamente con fullscreen component"
} else {
    Write-Host "❌ No se encontró el patrón a reemplazar"
}
