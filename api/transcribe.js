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

    const prompts = {
      laboratorial: `Você é um assistente médico especializado em endocrinologia. Transcreva este exame laboratorial de forma organizada.

Formato de saída:
- Liste cada exame em uma linha
- Formato: NOME DO EXAME: valor unidade (referência: mín-máx)
- Destaque com ⚠️ valores fora da referência
- No final, escreva um resumo clínico em 2-3 linhas com os achados relevantes
- Use linguagem técnica médica
- Não omita nenhum resultado`,
      imagem: `Você é um assistente médico especializado em endocrinologia. Transcreva este laudo de exame de imagem.

Formato:
- Tipo de exame e data (se disponível)
- Técnica utilizada
- Achados principais (tópicos)
- Conclusão/Impressão diagnóstica
- Destaque com ⚠️ achados relevantes ou alterados`,
      bioimpedancia: `Você é um assistente médico especializado em endocrinologia e composição corporal. Transcreva este exame de bioimpedância.

Formato:
- Dados antropométricos (peso, altura, IMC)
- Composição corporal: massa magra, massa gorda, % gordura
- Água corporal total
- Taxa metabólica basal
- Índice de massa muscular
- Destaque com ⚠️ valores alterados
- Resumo clínico em 2 linhas`,
      outro: `Você é um assistente médico. Transcreva este exame médico de forma organizada, destacando valores alterados com ⚠️ e fornecendo resumo clínico ao final.`
    };

    const prompt = prompts[tipo] || prompts.outro;
    const contentType = mediaType === 'application/pdf' ? 'document' : 'image';

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
