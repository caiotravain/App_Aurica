import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Stakeholder, StakeholderVariable } from './api';
import { offlineStorageService, PendingUpdate } from './offlineStorage';

interface DesviosReportData {
  stakeholder: Stakeholder;
  variables: StakeholderVariable[];
  responsavelNome: string;
  responsavelCpf?: string;
  usuarioNome?: string;
  assinaturaBase64: string; // Base64 signature image
  assinaturaUsuarioBase64: string; // Base64 user signature image
}

interface MetricWithDeviation {
  indicador: string;
  variavel: string;
  valor_atual: string;
  valor_meta: string;
  data_medicao?: string;
  observacoes?: string;
}

/**
 * Filters metrics where current_value != target_value
 */
function filterMetricsWithDeviations(variables: StakeholderVariable[]): MetricWithDeviation[] {
  const metrics: MetricWithDeviation[] = [];

  for (const variable of variables) {
    const valorAtual = variable.current_value || 'Não informado';
    const valorMeta = variable.target_value || 'Não definido';

    // Skip if no target defined
    if (valorMeta === 'Não definido' || !valorMeta) {
      continue;
    }

    // Skip if no current value
    if (valorAtual === 'Não informado' || !valorAtual) {
      continue;
    }

    // Try to compare as numbers if possible
    let hasDeviation = false;
    try {
      const atualNum = parseFloat(valorAtual.replace(',', '.'));
      const metaNum = parseFloat(valorMeta.replace(',', '.'));
      if (atualNum !== metaNum) {
        hasDeviation = true;
      }
    } catch (error) {
      // If not numbers, compare as strings
      if (valorAtual.trim() !== valorMeta.trim()) {
        hasDeviation = true;
      }
    }

    if (hasDeviation) {
      metrics.push({
        indicador: variable.indicator_variable.indicator.title,
        variavel: variable.indicator_variable.variable,
        valor_atual: valorAtual,
        valor_meta: valorMeta,
        data_medicao: variable.latest_data?.measurement_date 
          ? formatDateFromString(variable.latest_data.measurement_date) 
          : undefined,
        observacoes: variable.latest_data?.file_description || '-',
      });
    }
  }

  return metrics;
}

/**
 * Formats date to Brazilian timezone format
 */
function formatBrazilianDate(date: Date): string {
  // Convert to Brasília timezone (UTC-3)
  const brasiliaOffset = -3 * 60; // UTC-3 in minutes
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  
  const day = String(brasiliaTime.getDate()).padStart(2, '0');
  const month = String(brasiliaTime.getMonth() + 1).padStart(2, '0');
  const year = brasiliaTime.getFullYear();
  const hours = String(brasiliaTime.getHours()).padStart(2, '0');
  const minutes = String(brasiliaTime.getMinutes()).padStart(2, '0');
  const seconds = String(brasiliaTime.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function formatDateOnly(date: Date): string {
  const brasiliaOffset = -3 * 60;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  
  const day = String(brasiliaTime.getDate()).padStart(2, '0');
  const month = String(brasiliaTime.getMonth() + 1).padStart(2, '0');
  const year = brasiliaTime.getFullYear();
  
  return `${day}/${month}/${year}`;
}

function formatTimeOnly(date: Date): string {
  const brasiliaOffset = -3 * 60;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  
  const hours = String(brasiliaTime.getHours()).padStart(2, '0');
  const minutes = String(brasiliaTime.getMinutes()).padStart(2, '0');
  const seconds = String(brasiliaTime.getSeconds()).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Generates HTML content for the desvios report
 */
function generateHTML(data: DesviosReportData, metrics: MetricWithDeviation[]): string {
  const now = new Date();
  const dataGeracao = formatBrazilianDate(now);
  const dataAssinatura = formatDateOnly(now);
  const horaAssinatura = formatTimeOnly(now);

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Desvios - ${data.stakeholder.name}</title>
    <style>
        /* Reset básico para PDF */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background-color: white;
        }

        /* Header */
        .header {
            text-align: center;
            border-bottom: 2px solid #2E7D32;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .title {
            font-size: 20pt;
            font-weight: bold;
            color: #2E7D32;
            margin: 10px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .subtitle {
            font-size: 12pt;
            color: #666;
            margin-bottom: 15px;
        }

        .report-info {
            font-size: 10pt;
            color: #666;
            margin-bottom: 20px;
        }

        /* Seções */
        .section {
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 14pt;
            font-weight: bold;
            color: #2E7D32;
            margin: 20px 0 10px 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            text-transform: uppercase;
        }

        /* Informações da Empresa */
        .company-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #2E7D32;
            margin-bottom: 20px;
        }

        .company-info h3 {
            color: #2E7D32;
            margin-bottom: 10px;
            font-size: 12pt;
        }

        .info-row {
            margin-bottom: 5px;
        }

        .info-label {
            font-weight: bold;
            display: inline-block;
            width: auto;
            margin-right: 5px;
        }

        /* Tabela de Métricas */
        .metrics-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10pt;
            table-layout: auto;
        }

        .metrics-table th,
        .metrics-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            vertical-align: top;
            word-wrap: break-word;
        }

        .metrics-table th {
            background-color: #2E7D32;
            color: white;
            font-weight: bold;
            font-size: 10pt;
        }

        .metrics-table td {
            font-size: 9pt;
        }

        .metrics-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .metrics-table tr:hover {
            background-color: #f0f8f0;
        }

        /* Seção de Assinaturas */
        .signature-section {
            margin-top: 40px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
            page-break-inside: avoid;
        }

        .signature-content {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }

        .signature-image-cell {
            display: table-cell;
            width: 200px;
            vertical-align: top;
            padding-right: 20px;
        }

        .signature-info-cell {
            display: table-cell;
            vertical-align: top;
        }

        .signature-image {
            max-width: 200px;
            max-height: 100px;
            border: 1px solid #ccc;
            padding: 10px;
            background-color: #fafafa;
        }

        .signature-info {
            font-size: 10pt;
        }

        .signature-label {
            font-weight: bold;
            color: #2E7D32;
            margin-right: 5px;
        }

        /* Footer */
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10pt;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
        }

        .footer p {
            margin-bottom: 5px;
        }

        @page {
            size: A4;
            margin: 2cm;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="title">Relatório de Desvios</div>
        <div class="subtitle">Métricas com Valores Diferentes da Meta</div>
        <div class="report-info">
            <strong>Propriedade:</strong> ${data.stakeholder.name} |
            <strong>Empresa:</strong> ${data.stakeholder.company.name} |
            <strong>Data de Geração:</strong> ${dataGeracao}
        </div>
    </div>

    <!-- Informações da Empresa -->
    <div class="section">
        <div class="section-title">Informações</div>
        <div class="company-info">
            <div class="info-row">
                <span class="info-label">Empresa:</span> ${data.stakeholder.company.name}
            </div>
            ${data.stakeholder.administrator ? `
            <div class="info-row" style="white-space: nowrap;">
                <span class="info-label">Responsável da Propriedade:</span> ${data.stakeholder.administrator}
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Propriedade:</span> ${data.stakeholder.name}
            </div>
        </div>
    </div>

    <!-- Métricas com Desvios -->
    <div class="section">
        <div class="section-title">Métricas com Desvios</div>
        
        ${metrics.length > 0 ? `
        <table class="metrics-table">
            <thead>
                <tr>
                    <th>Indicador</th>
                    <th>Variável</th>
                    <th>Valor Atual</th>
                    <th>Meta</th>
                    <th>Data da Medição</th>
                    <th>Observações</th>
                </tr>
            </thead>
            <tbody>
                ${metrics.map(metrica => `
                <tr>
                    <td>${escapeHtml(metrica.indicador)}</td>
                    <td>${escapeHtml(metrica.variavel)}</td>
                    <td>${escapeHtml(metrica.valor_atual)}</td>
                    <td>${escapeHtml(metrica.valor_meta)}</td>
                    <td>${metrica.data_medicao ? escapeHtml(metrica.data_medicao) : '<span style="color: #999;">-</span>'}</td>
                    <td>${escapeHtml(metrica.observacoes || '-')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : `
        <div style="padding: 20px; text-align: center; color: #666; font-style: italic;">
            Nenhuma métrica com desvio encontrada. Todas as métricas estão dentro da meta.
        </div>
        `}
    </div>

    <!-- Seção de Assinaturas -->
    <div class="signature-section">
        <div class="section-title">Assinaturas</div>

        <!-- Assinatura do Responsável da Propriedade -->
        ${data.assinaturaBase64 ? `
        <div class="signature-content">
            <div class="signature-image-cell">
                <img src="${data.assinaturaBase64}" alt="Assinatura Digital do Responsável da Propriedade" class="signature-image">
            </div>

            <div class="signature-info-cell">
                <div class="signature-info">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #2E7D32;">Assinatura do Responsável da Propriedade</div>
                    <div style="white-space: nowrap;"><span class="signature-label">Assinado por:</span> ${escapeHtml(data.responsavelNome)}</div>
                    ${data.responsavelCpf ? `
                    <div style="white-space: nowrap;"><span class="signature-label">CPF:</span> <span style="margin-left: 10px;">${escapeHtml(data.responsavelCpf)}</span></div>
                    ` : ''}
                    <div style="white-space: nowrap;"><span class="signature-label">Data da Assinatura:</span> <span style="margin-left: 10px;">${dataAssinatura}</span></div>
                    <div style="white-space: nowrap;"><span class="signature-label">Horário:</span> <span style="margin-left: 10px;">${horaAssinatura}</span></div>
                    <div><span class="signature-label">Propriedade:</span> ${escapeHtml(data.stakeholder.name)}</div>
                    <div><span class="signature-label">Empresa:</span> ${escapeHtml(data.stakeholder.company.name)}</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Assinatura do Usuário -->
        ${data.assinaturaUsuarioBase64 ? `
        <div class="signature-content" style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
            <div class="signature-image-cell">
                <img src="${data.assinaturaUsuarioBase64}" alt="Assinatura Digital do Responsável ${data.stakeholder.company.name}" class="signature-image">
            </div>

            <div class="signature-info-cell">
                <div class="signature-info">
                    <div style="font-weight: bold; margin-bottom: 8px; color: #2E7D32;">Assinatura do Responsável ${escapeHtml(data.stakeholder.company.name)}</div>
                    ${data.usuarioNome ? `
                    <div style="white-space: nowrap;"><span class="signature-label">Assinado por:</span> ${escapeHtml(data.usuarioNome)}</div>
                    ` : ''}
                    <div style="white-space: nowrap;"><span class="signature-label">Data da Assinatura:</span> <span style="margin-left: 10px;">${dataAssinatura}</span></div>
                    <div style="white-space: nowrap;"><span class="signature-label">Horário:</span> <span style="margin-left: 10px;">${horaAssinatura}</span></div>
                </div>
            </div>
        </div>
        ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
        <p><strong>AURICA LTDA</strong></p>
        <p>Relatório gerado em ${dataGeracao}</p>
        <p>Este documento é confidencial e destinado apenas ao uso interno da empresa.</p>
    </div>
</body>
</html>
  `;

  return html;
}

/**
 * Formats date string from various formats (DD/MM/YYYY, YYYY-MM-DD, ISO) to DD/MM/YYYY display format
 */
function formatDateFromString(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') {
    return '';
  }

  // If already in DD/MM/YYYY format, return as is
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return dateStr;
  }

  // Try to parse YYYY-MM-DD format (from pending updates)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error parsing YYYY-MM-DD date:', dateStr, error);
    }
  }

  // Try to parse ISO date or other formats
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      // Use the date as-is but format it properly
      // Don't apply timezone conversion here since the date might already be correct
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
  }
  
  return dateStr; // Return original if parsing fails
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generates filename for the PDF
 */
function generateFilename(stakeholder: Stakeholder): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (brasiliaOffset * 60000));
  
  const timestamp = brasiliaTime.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  const companyName = stakeholder.company.name
    .replace(/ /g, '_')
    .replace(/\//g, '_')
    .replace(/\\/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  
  const stakeholderName = stakeholder.name
    .replace(/ /g, '_')
    .replace(/\//g, '_')
    .replace(/\\/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  
  return `relatorio_desvios_${companyName}_${stakeholderName}_${timestamp}.pdf`;
}

/**
 * Optimizes base64 signature images by checking size and compressing if needed
 */
function optimizeSignatureImage(base64Image: string): string {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return base64Image;
  }

  // Check if image is too large (more than 500KB base64)
  // Base64 is ~33% larger than binary, so 500KB base64 ≈ 375KB binary
  if (base64Image.length > 500 * 1024) {
    console.warn('Signature image is large, may cause slow PDF generation');
    // For now, we'll still use it but log a warning
    // In the future, we could compress it here
  }

  return base64Image;
}

/**
 * Generates the desvios report PDF offline
 */
export async function generateOfflineDesviosReport(
  data: DesviosReportData
): Promise<{ uri: string; filename: string }> {
  console.log('Starting offline desvios report generation...');
  
  try {
    // Filter metrics with deviations
    console.log(`Filtering metrics from ${data.variables.length} variables...`);
    const metrics = filterMetricsWithDeviations(data.variables);
    console.log(`Found ${metrics.length} metrics with deviations`);

    // Optimize signature images
    const optimizedResponsavelSignature = optimizeSignatureImage(data.assinaturaBase64);
    const optimizedUsuarioSignature = optimizeSignatureImage(data.assinaturaUsuarioBase64);

    // Generate HTML
    console.log('Generating HTML...');
    const html = generateHTML(
      {
        ...data,
        assinaturaBase64: optimizedResponsavelSignature,
        assinaturaUsuarioBase64: optimizedUsuarioSignature,
      },
      metrics
    );
    console.log(`HTML generated (${Math.round(html.length / 1024)}KB)`);

    // Generate PDF with timeout protection
    console.log('Generating PDF (this may take a moment)...');
    const pdfPromise = Print.printToFileAsync({
      html,
      base64: false,
    });

    // Add timeout (60 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('PDF generation timeout: The operation took too long. Please try again or check if signature images are too large.'));
      }, 60000);
    });

    const { uri } = await Promise.race([pdfPromise, timeoutPromise]);
    console.log('PDF generated successfully');

    // Generate filename
    console.log('Generating filename...');
    const filename = generateFilename(data.stakeholder);

    // Try to move file to documents directory with proper name
    // If documentDirectory is not available, use cacheDirectory or the original URI
    const documentsDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
    if (!documentsDir) {
      // If neither is available, return the original URI from printToFileAsync
      console.warn('Documents and cache directories not available, using original PDF URI');
      return {
        uri: uri,
        filename: filename,
      };
    }

    try {
      console.log('Moving PDF to reports directory...');
      const reportsDir = `${documentsDir}reports/`;
      const dirInfo = await FileSystem.getInfoAsync(reportsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
      }

      const finalUri = `${reportsDir}${filename}`;
      await FileSystem.moveAsync({
        from: uri,
        to: finalUri,
      });

      console.log('PDF saved successfully:', finalUri);
      return {
        uri: finalUri,
        filename,
      };
    } catch (moveError) {
      // If moving fails, return the original URI
      console.warn('Failed to move PDF to reports directory, using original URI:', moveError);
      return {
        uri: uri,
        filename: filename,
      };
    }
  } catch (error) {
    console.error('Error generating offline desvios report:', error);
    if (error instanceof Error) {
      // Re-throw with more context
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Merges pending updates with cached variables to get the most recent data
 */
function mergePendingUpdatesWithVariables(
  variables: StakeholderVariable[],
  pendingUpdates: PendingUpdate[]
): StakeholderVariable[] {
  // Create a map of the latest pending update for each variable
  const latestUpdatesByVariable = new Map<number, PendingUpdate>();
  
  for (const update of pendingUpdates) {
    const existing = latestUpdatesByVariable.get(update.stakeholder_variable_id);
    if (!existing || new Date(update.created_at) > new Date(existing.created_at)) {
      latestUpdatesByVariable.set(update.stakeholder_variable_id, update);
    }
  }

  // Merge updates into variables
  return variables.map((variable) => {
    const pendingUpdate = latestUpdatesByVariable.get(variable.id);
    
    if (!pendingUpdate) {
      // No pending update for this variable, return as is
      return variable;
    }

    // Merge the pending update into the variable
    const merged: StakeholderVariable = {
      ...variable,
      // Update current_value with the pending update value
      current_value: pendingUpdate.value,
      // Update latest_data with the pending update
      latest_data: {
        value: pendingUpdate.value,
        measurement_date: pendingUpdate.measurement_date,
        data_quality: 'pending', // Mark as pending since it hasn't been synced
        has_attachments: !!pendingUpdate.photo_uri,
        file_description: pendingUpdate.file_description,
        created_at: pendingUpdate.created_at,
      },
    };

    return merged;
  });
}

/**
 * Gets stakeholder variables from offline storage and generates report
 * Includes pending updates (unsynced measurements) in the report
 */
export async function generateDesviosReportFromOfflineData(
  stakeholderId: number,
  responsavelNome: string,
  responsavelCpf: string | undefined,
  usuarioNome: string | undefined,
  assinaturaBase64: string,
  assinaturaUsuarioBase64: string
): Promise<{ uri: string; filename: string }> {
  // Get stakeholder and variables from offline storage
  const stakeholders = await offlineStorageService.getCachedStakeholders();
  const stakeholder = stakeholders.find((s) => s.id === stakeholderId);

  if (!stakeholder) {
    throw new Error(`Stakeholder with ID ${stakeholderId} not found in offline storage`);
  }

  // Get cached variables
  let variables = await offlineStorageService.getCachedStakeholderVariables(stakeholderId);

  // Get all pending updates for this stakeholder
  const allPendingUpdates = await offlineStorageService.getPendingUpdates();
  const stakeholderPendingUpdates = allPendingUpdates.filter((update) => {
    // Filter updates that belong to variables of this stakeholder
    return variables.some((v) => v.id === update.stakeholder_variable_id);
  });

  // Merge pending updates with cached variables
  if (stakeholderPendingUpdates.length > 0) {
    console.log(`Found ${stakeholderPendingUpdates.length} pending updates for stakeholder ${stakeholderId}, merging with cached variables`);
    variables = mergePendingUpdatesWithVariables(variables, stakeholderPendingUpdates);
  }

  const reportData: DesviosReportData = {
    stakeholder,
    variables,
    responsavelNome,
    responsavelCpf,
    usuarioNome,
    assinaturaBase64,
    assinaturaUsuarioBase64,
  };

  return generateOfflineDesviosReport(reportData);
}

