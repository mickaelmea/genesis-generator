import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PenTool, Settings, FileText, Copy, RefreshCw, Zap, 
  Layout, Search, CheckCircle, AlertCircle, Hash, 
  MessageSquare, Globe, Image as ImageIcon, Sparkles,
  AlignLeft, BarChart3, Wand2, List, BookOpen, Star,
  Activity, Gauge, ExternalLink, Share2, Calendar, Eye,
  GraduationCap, Wrench, BookText, Sparkles as SparklesIcon,
  Link as LinkIcon, Camera, Loader2, Info, TrendingUp,
  Target, MousePointer2
} from 'lucide-react';
import { marked } from 'marked';

// Configurações do Marked
marked.setOptions({ breaks: true, gfm: true, headerIds: true });

// --- CONSTANTES ---

const SYSTEM_ROLES = {
  seoExpert: "Você é um redator especialista em SEO e estrategista de conteúdo. Seu estilo foca na intenção de busca e nos princípios E-E-A-T (Experiência, Especialidade, Autoridade e Confiança).",
  productReviewer: "Você é um analista técnico especializado em análises imparciais e profundas de produtos.",
  creativeWriter: "Você é um copywriter criativo focado em storytelling e retenção."
};

const ARTICLE_TEMPLATES = {
  guide: { label: "Guia Completo", icon: BookOpen, structure: "Intro -> O que é -> Passo a Passo -> Benefícios -> FAQ -> Conclusão." },
  listicle: { label: "Lista (Top X)", icon: List, structure: "Intro -> Itens Numerados (H2) -> Por que escolher cada um -> Conclusão." },
  review: { label: "Review/Análise", icon: Star, structure: "Resumo -> Ficha Técnica -> Prós/Contras -> Comparação -> Veredicto." }
};

const TONE_PROFILES = {
  especialista: { label: "Especialista Acessível", icon: "🎓", instructions: "Autoridade silenciosa, tom claro e direto, insights práticos." },
  mentor: { label: "Mentor Prático", icon: "🛠️", instructions: "Focado em soluções, linguagem coloquial, 'truques que funcionam'." },
  contador: { label: "Storyteller", icon: "📖", instructions: "Narrativa envolvente, identificação do leitor, exemplos vívidos." },
  entusiasta: { label: "Entusiasta Inspirador", icon: "✨", instructions: "Energético, positivo, foca no 'porquê' e na alegria do processo." }
};

const serpCache = new Map();

// --- FUNÇÕES AUXILIARES DE ANÁLISE ---

const extractTitlePatterns = (titles) => {
  const patterns = {
    listPatterns: titles.filter(t => /^\d+|Top \d+|Melhores \d+/.test(t)),
    howToPatterns: titles.filter(t => /Como |Guia |Tutorial|Passo a Passo/i.test(t)),
    questionPatterns: titles.filter(t => /\?|Por que|Qual |Quando |Onde /.test(t)),
    ultimatePatterns: titles.filter(t => /Completo|Definitivo|Essencial|Absoluto/i.test(t))
  };
  return {
    mostCommon: Object.entries(patterns)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([type, items]) => ({ type, count: items.length, examples: items.slice(0, 2) }))
  };
};

const findMissingFAQs = (relatedQuestions, snippets) => {
  if (!relatedQuestions) return [];
  const coveredTopics = snippets.join(' ').toLowerCase();
  return relatedQuestions
    .filter(q => {
      const questionWords = q.question.toLowerCase().split(/\W+/);
      const coverageScore = questionWords.filter(w => w.length > 3 && coveredTopics.includes(w)).length;
      return coverageScore < questionWords.length * 0.3;
    })
    .map(q => q.question)
    .slice(0, 5);
};

const identifyShallowTopics = (organicResults) => {
  return (organicResults || [])
    .filter(r => r.snippet && r.snippet.length < 120)
    .map(r => ({ title: r.title, snippetLength: r.snippet.length, likelyShallow: true }))
    .slice(0, 3);
};

// Helpers de Título
const extractMainNoun = (topic) => topic.split(' ').slice(-1)[0];
const extractMainQuestion = (topic) => `O que é ${topic}`;
const getAlternative = (topic) => "Concorrentes";
const applyPattern = (topic, example) => example.includes(topic) ? example : `${topic}: ${example}`;
const generateSlug = (title) => title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 60);
const estimateCTR = (title, blueprint) => title.length > 50 && title.length < 65 ? 18.5 : 12.4;
const checkKeywordInTitle = (title, keywords) => keywords.split(',').some(k => title.toLowerCase().includes(k.trim().toLowerCase()));

// --- CUSTOM HOOKS ---

const useWpIntegration = (wpConfig) => {
  const [publishOption, setPublishOption] = useState('draft');
  const [wpPostsCache, setWpPostsCache] = useState({ data: [], lastFetched: null, siteUrl: '' });
  const [isFetchingWpPosts, setIsFetchingWpPosts] = useState(false);

  const fetchWpPosts = useCallback(async (forceRefresh = false) => {
    if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.appPassword) return;
    const now = Date.now();
    if (!forceRefresh && wpPostsCache.data.length > 0 && wpPostsCache.siteUrl === wpConfig.siteUrl && (now - (wpPostsCache.lastFetched || 0)) < 300000) return;
    
    setIsFetchingWpPosts(true);
    const auth = 'Basic ' + btoa(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`);
    try {
      const res = await fetch(`${wpConfig.siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=50`, { headers: { 'Authorization': auth } });
      if (res.ok) {
        const posts = await res.json();
        const formatted = posts.map(p => ({ id: p.id, title: p.title.rendered, link: p.link }));
        const newCache = { data: formatted, lastFetched: now, siteUrl: wpConfig.siteUrl };
        setWpPostsCache(newCache);
        localStorage.setItem('genesis_wp_posts', JSON.stringify(newCache));
      }
    } catch (e) { console.error("WP Error", e); } finally { setIsFetchingWpPosts(false); }
  }, [wpConfig, wpPostsCache]);

  return { publishOption, setPublishOption, wpPostsCache, setWpPostsCache, isFetchingWpPosts, fetchWpPosts };
};

// --- COMPONENTE APP ---

const App = () => {
  const apiKey = ""; 
  const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";

  // Estados
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [template, setTemplate] = useState('guide');
  const [selectedTone, setSelectedTone] = useState('especialista');
  const [wpConfig, setWpConfig] = useState({ siteUrl: '', username: '', appPassword: '' });
  const [activeTab, setActiveTab] = useState('editor');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Estados de Análise Avançada
  const [serpBlueprint, setSerpBlueprint] = useState(null);
  const [titleOptions, setTitleOptions] = useState([]);
  const [metaDescription, setMetaDescription] = useState('');
  const [groundingSources, setGroundingSources] = useState([]);
  const [imagePrompts, setImagePrompts] = useState([]);

  const { publishOption, setPublishOption, wpPostsCache, isFetchingWpPosts, fetchWpPosts } = useWpIntegration(wpConfig);

  const fetchWithRetry = async (url, options, maxRetries = 5) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        return res;
      } catch (err) { if (i === maxRetries - 1) throw err; }
    }
  };

  // 1. ANÁLISE AVANÇADA DA SERP
  const performAdvancedSERPAnalysis = async (query) => {
    if (serpCache.has(query)) return serpCache.get(query);
    setStatus('researching');
    const SERP_API_KEY = "30d629aee0b6b377c33effa2ccb1a16e3bc35c563e81d9ac4822569eb80cbb42";
    const API_URL = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}&num=15&gl=br&hl=pt-br`;
    
    try {
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(API_URL)}`);
      const data = await response.json();
      const results = data.organic_results || [];
      const titles = results.slice(0, 10).map(r => r.title) || [];
      const snippets = results.slice(0, 10).map(r => r.snippet) || [];

      const blueprint = {
        titleAnalysis: {
          patterns: extractTitlePatterns(titles),
          lengthStats: {
            min: Math.min(...titles.map(t => t.length), 0),
            max: Math.max(...titles.map(t => t.length), 0),
            avg: titles.length ? Math.round(titles.reduce((a, t) => a + t.length, 0) / titles.length) : 60
          }
        },
        snippetAnalysis: {
          lengthStats: { avg: snippets.length ? Math.round(snippets.reduce((a, s) => a + s.length, 0) / snippets.length) : 155 },
          ctas: ["Confira agora", "Saiba mais", "Veja o guia"],
          powerWords: ["Definitivo", "Completo", "Grátis", "2025", "Fácil"]
        },
        contentGaps: {
          missingFAQs: findMissingFAQs(data.related_questions, snippets),
          shallowTopics: identifyShallowTopics(results),
        },
        structureAnalysis: {
          commonSections: ["Introdução", "Vantagens", "Passo a Passo", "Conclusão"],
          contentDepth: { estimatedWords: 1500 }
        },
        rawData: {
          topTitles: titles,
          topSnippets: snippets,
          results: results,
          peopleAlsoAsk: data.related_questions?.slice(0, 8) || [],
          relatedSearches: data.related_searches?.slice(0, 10) || []
        }
      };
      
      serpCache.set(query, blueprint);
      return blueprint;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // 2. GERAÇÃO DE TÍTULOS
  const generateSEOTitles = (topic, blueprint, kws) => {
    const patterns = blueprint.titleAnalysis.patterns.mostCommon;
    const year = new Date().getFullYear();
    const formulas = {
      ultimateGuide: `Guia Completo de ${topic} em ${year}: Tudo o que Você Precisa Saber`,
      listArticle: `${blueprint.rawData.topTitles.length + 1} Melhores ${extractMainNoun(topic)} para seu Sucesso`,
      howTo: `Como ${topic}: Passo a Passo Detalhado (Com Exemplos Práticos)`,
      questionBased: `${extractMainQuestion(topic)}? Descubra a Resposta Definitiva`,
    };

    return [
      applyPattern(topic, patterns[0]?.examples[0] || formulas.ultimateGuide),
      `${kws.split(',')[0]} - ${formulas.howTo}`,
      `${formulas.ultimateGuide}`,
      `${topic}: O que Ninguém Conta sobre ${blueprint.contentGaps.missingFAQs[0]?.split('?')[0] || 'este tema'}`,
      formulas.questionBased
    ].map(title => ({
      title,
      slug: generateSlug(title),
      estimatedCTR: estimateCTR(title, blueprint),
      length: title.length,
      keywordInTitle: checkKeywordInTitle(title, kws)
    }));
  };

  // 3. META DESCRIÇÃO ESTRATÉGICA
  const generateStrategicMeta = async (articleContent, blueprint) => {
    const ctas = blueprint.snippetAnalysis.ctas;
    const powerWords = blueprint.snippetAnalysis.powerWords;
    const idealLength = blueprint.snippetAnalysis.lengthStats.avg;
    
    const prompt = `Gere uma meta descrição SEO para: ${topic}. CTAs: ${ctas.join(', ')}. Power Words: ${powerWords.join(', ')}. Comprimento: ${idealLength}. Responda: ${blueprint.contentGaps.missingFAQs[0] || 'o problema principal'}.`;
    
    const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: "Especialista em copywriting SEO." }] } })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  };

  // 5. INTEGRAÇÃO NO FLUXO PRINCIPAL
  const handleGenerate = async () => {
    if (!topic) return setError("Informe o tópico.");
    setError(null);
    setOutput('');

    // Pesquisa Avançada
    const blueprint = await performAdvancedSERPAnalysis(topic);
    if (!blueprint) return setError("Erro na análise da SERP.");
    setSerpBlueprint(blueprint);
    
    // Preparar lista de Grounding e Links Externos
    const extLinks = blueprint.rawData.results.slice(0, 5).map(r => ({ title: r.title, url: r.link }));
    setGroundingSources(extLinks.map(l => ({ title: l.title, uri: l.url })));

    // Títulos e Meta
    const titles = generateSEOTitles(topic, blueprint, keywords);
    setTitleOptions(titles);

    setStatus('generating_draft');
    const gapInstructions = `
      PREENCHIMENTO OBRIGATÓRIO DE LACUNAS:
      1. Dedique uma seção H2 completa para: "${blueprint.contentGaps.missingFAQs[0] || 'Dúvidas Frequentes'}"
      2. No tópico "${blueprint.contentGaps.shallowTopics[0]?.title || 'Visão Geral'}", forneça exemplos práticos e dados.
      3. Inclua uma tabela comparativa.
    `;

    const intCtx = wpPostsCache.data.slice(0, 15).map(p => `ID: ${p.id} (${p.title})`).join(', ');
    const extCtx = extLinks.map(l => `- [${l.title}](${l.url})`).join('\n');

    const systemPrompt = `
      ${SYSTEM_ROLES.seoExpert}
      TONALIDADE: ${TONE_PROFILES[selectedTone].instructions}
      OBJETIVO: Artigo focado em SEO de alta autoridade.
      
      // REGRA CRÍTICA PARA NATURALIDADE
      NUNCA use termos como "E-E-A-T", "Experiência", "Especialidade", "Autoridade" ou "Confiança" explicitamente no texto. Demonstre essas qualidades através da profundidade do conteúdo.
      
      🔗 LINKAGEM INTERNA (MANDATÓRIO):
      Insira pelo menos 3 links internos no meio do texto usando EXATAMENTE: <!-- LINK_INTERNO: [ID] -->
      IDs disponíveis: ${intCtx}
      
      🔗 LINKAGEM EXTERNA (MANDATÓRIO):
      Você DEVE citar fontes externas de autoridade da lista abaixo para dar credibilidade ao texto. 
      Use o formato Markdown [Título](URL) naturalmente no decorrer dos parágrafos.
      FONTES EXTERNAS PARA CITAR:
      ${extCtx}
      
      POWER WORDS PARA USAR: ${blueprint.snippetAnalysis.powerWords.join(', ')}
      ${gapInstructions}
    `;

    try {
      const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Escreva o artigo completo sobre ${topic}. 
          MANDATÓRIO: Use os links internos <!-- LINK_INTERNO: [ID] --> e TAMBÉM inclua links externos em Markdown [Título](URL) citando as fontes fornecidas na instrução do sistema. 
          Estrutura base: ${ARTICLE_TEMPLATES[template].structure}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setStatus('processing_links');
        let processed = text.replace(/<!--\s*LINK_INTERNO:\s*\[?(\d+)\]?\s*-->/g, (match, id) => {
          const post = wpPostsCache.data.find(p => p.id === parseInt(id));
          return post ? `<a href="${post.link}" class="internal-link" target="_blank">${post.title}</a>` : '';
        });

        setOutput(processed);
        const meta = await generateStrategicMeta(processed, blueprint);
        setMetaDescription(meta);
        setStatus('idle');
      }
    } catch (e) { setError("Erro na geração."); setStatus('idle'); }
  };

  const publishToWp = async () => {
    if (!wpConfig.siteUrl) return setError("Configure o WP.");
    setStatus('publishing');
    const auth = 'Basic ' + btoa(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`);
    try {
      const res = await fetch(`${wpConfig.siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify({ title: titleOptions[0]?.title || topic, content: marked.parse(output), status: publishOption })
      });
      if (res.ok) alert("Publicado!");
      else setError("Erro no WP.");
    } catch (e) { setError("Erro."); } finally { setStatus('idle'); }
  };

  const SEOToolsPanel = () => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col gap-4">
      <h3 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
        <BarChart3 className="text-indigo-600" /> Inteligência SEO
      </h3>
      
      {titleOptions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase">Sugestões de Título (CTR Máximo)</h4>
          <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
            {titleOptions.map((opt, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all cursor-pointer" onClick={() => { navigator.clipboard.writeText(opt.title); alert('Copiado!'); }}>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">{opt.title}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md shrink-0">
                    {opt.estimatedCTR}% CTR
                  </span>
                </div>
                <div className="text-[8px] text-slate-400 mt-1 font-mono">slug: {opt.slug}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {serpBlueprint?.contentGaps?.missingFAQs.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Content Gaps (Ouro SEO)</h4>
          <div className="space-y-2">
            {serpBlueprint.contentGaps.missingFAQs.slice(0, 3).map((faq, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                <Target size={12} className="text-amber-600 mt-0.5 shrink-0" />
                <span className="text-[10px] text-amber-800 font-bold leading-tight">{faq}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const metrics = useMemo(() => {
    if (!output) return null;
    const words = output.trim().split(/\s+/).length;
    const headings = (output.match(/^#{1,3}\s/gm) || []).length;
    return { wordCount: words, headingCount: headings, score: Math.min(100, Math.round((words/1200)*50 + (headings/6)*50)) };
  }, [output]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[380px_1fr] h-screen overflow-hidden">
        
        {/* Painel Lateral */}
        <aside className="bg-white border-r border-slate-200 overflow-y-auto p-6 flex flex-col gap-6 shadow-xl z-30">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl"><Zap className="text-white w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter leading-none">GΞNΞSIS</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">v3.2 SEO Blueprint</span>
            </div>
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase block">Input Principal</label>
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tópico Central..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-600 outline-none h-24 resize-none font-medium" />
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords (sep. por vírgula)..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm" />
            </section>

            <section>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">Tipo e Tom</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {Object.entries(ARTICLE_TEMPLATES).map(([key, val]) => (
                  <button key={key} onClick={() => setTemplate(key)} className={`p-2.5 rounded-xl border-2 text-[10px] font-bold transition-all ${template === key ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                    {val.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TONE_PROFILES).map(([key, val]) => (
                  <button key={key} onClick={() => setSelectedTone(key)} className={`p-2.5 rounded-xl border-2 text-[10px] font-bold transition-all ${selectedTone === key ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                    {val.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Settings size={12}/> WordPress</h4>
              <input type="text" placeholder="URL Site" value={wpConfig.siteUrl} onChange={(e) => setWpConfig({...wpConfig, siteUrl: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
              <input type="text" placeholder="User" value={wpConfig.username} onChange={(e) => setWpConfig({...wpConfig, username: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
              <input type="password" placeholder="Senha App" value={wpConfig.appPassword} onChange={(e) => setWpConfig({...wpConfig, appPassword: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs" />
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>{wpPostsCache.data.length} posts</span>
                <button onClick={() => fetchWpPosts(true)} className="text-indigo-600 underline">Sync</button>
              </div>
            </section>

            <button onClick={handleGenerate} disabled={status !== 'idle'} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
              {status === 'idle' ? <TrendingUp size={18}/> : <Loader2 size={18} className="animate-spin" />}
              {status === 'idle' ? 'GERAR ARTIGO ELITE' : 'ANALISANDO SERP...'}
            </button>
          </div>
          {error && <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-[10px] rounded-xl flex items-center gap-2 font-bold"><AlertCircle size={14}/> {error}</div>}
        </aside>

        {/* Área Principal */}
        <main className="overflow-y-auto p-8 flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6 shrink-0">
             <SEOToolsPanel />
             
             <div className="col-span-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-2"><MousePointer2 size={16} className="text-purple-600" /><h3 className="text-xs font-black uppercase">Meta Estratégica</h3></div>
              <div className="p-3 bg-purple-50 rounded-2xl text-[10px] text-purple-700 italic leading-relaxed min-h-[100px] flex-1">
                {metaDescription || "A meta descrição estratégica será gerada após a análise competitiva."}
              </div>
            </div>

            <div className="col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
               <div className="flex items-center gap-2 mb-3"><Globe size={16} className="text-emerald-600" /><h3 className="text-xs font-black uppercase">Grounding Concorrentes</h3></div>
               <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[120px] custom-scrollbar pr-2">
                 {groundingSources.map((s, i) => (
                   <a key={i} href={s.uri} target="_blank" className="px-3 py-2 bg-slate-50 border rounded-xl text-[9px] font-bold text-slate-500 truncate hover:text-indigo-600 transition-colors">
                     {s.title}
                   </a>
                 ))}
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl flex-1 flex flex-col overflow-hidden min-h-[600px]">
             <div className="px-8 py-5 border-b flex justify-between items-center bg-white sticky top-0 z-10">
               <div className="flex gap-4">
                 <button onClick={() => setActiveTab('editor')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === 'editor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400'}`}>Editor</button>
                 <button onClick={() => setActiveTab('preview')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400'}`}>Preview</button>
               </div>
               <div className="flex gap-2">
                  <button onClick={publishToWp} disabled={!output || status !== 'idle'} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all">PUBLIK NO WP</button>
                  <button onClick={() => { navigator.clipboard.writeText(output); alert("Copiado!"); }} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black active:scale-95 transition-all">COPY MD</button>
               </div>
             </div>

             <div className="flex-1 p-12 overflow-y-auto custom-scrollbar bg-white">
                {output ? (
                  activeTab === 'editor' ? (
                    <div className="whitespace-pre-wrap font-serif text-slate-700 leading-relaxed text-xl">{output}</div>
                  ) : (
                    <div className="prose prose-indigo max-w-none prose-h2:font-black prose-p:text-slate-600 prose-p:leading-8 prose-a:text-indigo-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline" dangerouslySetInnerHTML={{ __html: marked.parse(output) }} />
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-200">
                    <TrendingUp size={120} className="animate-pulse" />
                    <p className="font-black text-2xl mt-4 tracking-[0.5em] opacity-50 uppercase italic">SEO Blueprint Engine</p>
                  </div>
                )}
             </div>

             {metrics && (
               <div className="p-4 bg-slate-50 border-t flex justify-around text-[10px] font-black text-slate-400 uppercase tracking-widest px-10">
                 <div className="flex items-center gap-2"><FileText size={14}/> {metrics.wordCount} Palavras</div>
                 <div className="flex items-center gap-2"><AlignLeft size={14}/> {metrics.headingCount} Tópicos (H2/H3)</div>
                 <div className={`flex items-center gap-2 ${metrics.score > 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                   <Gauge size={14}/> Qualidade SEO: {metrics.score}%
                 </div>
               </div>
             )}
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
        .font-sans { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-serif { font-family: 'Lora', serif; }
        .internal-link { color: #4f46e5; text-decoration: underline; font-weight: 700; cursor: pointer; transition: color 0.2s; }
        .prose h2 { font-weight: 900; color: #0f172a; margin-top: 2.5em; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5em; }
        .prose h3 { font-weight: 800; color: #1e293b; margin-top: 1.5em; }
      `}</style>
    </div>
  );
};

export default App;