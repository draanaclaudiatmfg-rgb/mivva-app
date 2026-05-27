export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.Anthropic_key;
  if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

  try {
    const { fileData, mediaType, tipo } = req.body;
    const contentType = mediaType === 'application/pdf' ? 'document' : 'image';

    const prompt = `Você é um assistente médico especializado em transcrição de exames clínicos para a Dra. Ana Cláudia Meirelles, endocrinologista.

Identifique o tipo de exame e aplique o formato correto:

## TIPO A — Exames Laboratoriais
Formato: linha única, SIGLA MAIÚSCULA valor, separados por vírgula, sem unidades, ponto como decimal.
Cabeçalho: [Laboratório], [data]:
Exemplo: Laboratório X, 03/2025: TSH 1.3, T4L 1.3, GLICOSE 88, HBA1C 4.7, INSULINA 5,

HEMOGRAMA: transcrever APENAS 4 campos: HB, HT, LEUCO, PLQ — ignorar todo o resto.

Siglas obrigatórias:
TSH, T4L, T3L, ANTI-TPO, ANTI-TG, GLICOSE, HBA1C, INSULINA, COLESTEROL TOTAL, LDL, HDL, TRIGLI, VLDL, NAO-HDL, TGO, TGP, GGT, FERRITINA, FERRO, CREATININA, UREIA, VIT D, B12, AC FOLICO, CORTISOL, DHEAS, E2, FSH, LH, PROGEST, PROLACT, TESTO, TESTO LIVRE, PCR, CALCIO IONIZADO, SODIO, POTASSIO, MAGNESIO, FOSFORO, ZINCO, ALBUMINA, HB, HT, LEUCO, PLQ, BT, BD, BI, AC URICO, PSA

Para exames fora da lista, criar sigla curta em maiúsculas.

## TIPO B — Urina 1 (EAS)
Formato: [Lab], [data] — URINA 1: [campo]: [valor], (apenas campos ALTERADOS)
Se tudo normal: [Lab], [data] — URINA 1: sem alterações.

## TIPO C/D — Laudos de Imagem (USG, TC, RM, Densitometria, ECO)
Formato texto corrido por órgão/estrutura.
Para nódulos: localização, dimensões (3 eixos), ecogenicidade, composição, contornos, calcificações, vascularização, TIRADS/BI-RADS.
Sempre incluir Conclusão do laudo.
Omitir achados normais irrelevantes.

## PRIVACIDADE
Remover: nome do paciente, CPF, RG, data de nascimento, endereço, telefone.
Substituir por [PACIENTE] se necessário.

## REGRAS GERAIS
- Leia todo o exame antes de transcrever
- Valores ilegíveis: [?]
- Múltiplos exames no mesmo arquivo: transcrever separadamente com título
- Manter ordem do laudo
- Não omitir nenhum resultado (exceto hemograma — só 4 campos)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: contentType,
              source: { type: 'base64', media_type: mediaType, data: fileData }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) { res.status(400).json({ error: data.error.message }); return; }
    const texto = data.content?.[0]?.text || 'Não foi possível transcrever.';
    res.status(200).json({ transcricao: texto });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
