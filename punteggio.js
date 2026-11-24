// Punteggio «Quanto conviene contattarlo», da 0 a 100, per il motore abbigliamento (Maglificio Vela Blu).
// Regole dichiarate, senza dati storici di vendita: e' una stima per decidere da chi partire, non una misura.
// Ogni indicatore vale da 0 a 100, oppure null se non lo sappiamo: quelli che non sappiamo
// non abbassano il punteggio, i pesi si ridistribuiscono sugli altri.
(function(){
  // tipi in ordine di priorita': prima chi vende gia' uomo di fascia alta
  const TIPI = {
    uomo:      {label:'Boutique uomo', rango:1, base:85},
    boutique:  {label:'Boutique e multimarca', rango:2, base:65},
    abiti:     {label:'Negozi di abbigliamento', rango:3, base:40},
    sartoria:  {label:'Sartorie e camicerie', rango:4, base:60},
    magazzino: {label:'Grandi magazzini', rango:5, base:55},
    marchio:   {label:'Marchi di moda (produzione conto terzi)', rango:6, base:55, terzi:true}
  };
  const NOMI = {A:'Fascia e scaffale', B:'Vende uomo e maglieria', E:'Come contattarlo'};
  const PESI = {A:.50, B:.25, E:.25};
  const NOMI_M = {A:'Ha una collezione sua da far produrre', B:'Fa maglieria o polo', E:'Come contattarlo'};

  function scala(n, soglie){ for(const [s,v] of soglie) if(n>=s) return v; return soglie[soglie.length-1][1]; }

  // quello che arriva dal sito letto resta salvato nel browser: se un dato vecchio o rovinato non ha la forma giusta, lo sistemo
  function pulisci(li){
    if(!li || typeof li!=='object') return null;
    const o={...li};
    for(const k of ['marchiMaglia','marchiUomo','email','whatsapp']) o[k] = Array.isArray(li[k]) ? li[k].filter(x=>typeof x==='string').slice(0,12) : [];
    { const n=+li.prezzo; o.prezzo = Number.isFinite(n)&&n>0 ? Math.min(n,5000) : null; }
    for(const k of ['nPrezzi','marchiBassi','uomo','donna','maglia','italia','sartoria','negozio','lusso','outlet','marchio','multimarca','lavoro']){
      const n=+li[k]; o[k] = Number.isFinite(n)&&n>0 ? n : 0; }
    o.vivo = li.vivo===true; o.vuoto = li.vuoto===true; o.dns = li.dns===true;
    o.lingua = typeof li.lingua==='string' && /^[a-z]{2}$/.test(li.lingua) ? li.lingua : '';
    o.motivo = typeof li.motivo==='string' ? li.motivo.slice(0,120) : '';
    o.data = typeof li.data==='string' ? li.data.slice(0,10) : '';
    o.social = {};
    if(li.social && typeof li.social==='object' && !Array.isArray(li.social)) for(const k of ['instagram','facebook','tiktok','linkedin']) if(typeof li.social[k]==='string') o.social[k]=li.social[k].slice(0,300);
    return o;
  }

  // l: {type, nome, cat, canale (0 email, 1 WhatsApp, 2 Instagram, 3 telefono), li (cosa dice il sito), sedi}
  function calcola(l){
    l = {...l, li:pulisci(l.li)};
    const li = (l.li && l.li.vivo && !l.li.vuoto) ? l.li : null;
    const t = TIPI[l.type] || {base:50};
    const ind = {}, perche = [], manca = [], crit = [];
    const terzi = !!t.terzi;

    // A · fascia e scaffale: solo da quello che dice il suo sito
    let A = null;
    if(li && !terzi){
      const mm = li.marchiMaglia.length, mu = li.marchiUomo.length, v = [];
      if(mm) v.push(scala(mm, [[4,100],[2,92],[1,80]]));
      if(mu) v.push(scala(mu, [[5,95],[2,85],[1,72]]));
      if(li.prezzo && li.nPrezzi>=5) v.push(scala(li.prezzo, [[250,80],[150,72],[90,55],[0,30]]));   // il prezzo da solo non basta: anche un monomarca è caro
      if(v.length) A = Math.max(...v);
      else if(li.lusso>0) A = 60;
      else A = 40;
      if(mm) perche.push('Vende già maglieria di fascia alta: '+li.marchiMaglia.slice(0,4).join(', ')+(mm>4?' e altri '+(mm-4):'')+'.');
      if(mu) perche.push('Tratta abbigliamento uomo italiano di fascia alta: '+li.marchiUomo.slice(0,4).join(', ')+(mu>4?' e altri '+(mu-4):'')+'.');
      if(li.prezzo && li.nPrezzi>=5) (li.prezzo>=150?perche:crit).push('Prezzo medio sul sito circa '+li.prezzo+' (su '+li.nPrezzi+' prezzi letti).');
      if(li.marchiBassi>=3 && !mm && !mu){ A = Math.min(A, 35); crit.push('Sul sito compaiono soprattutto marchi di fascia media: '+li.marchiBassi+'.'); }
      if(li.prezzo && li.nPrezzi>=10 && li.prezzo<90){ A = Math.max(0, A-25); crit.push('Prezzi bassi sul sito: può essere un outlet o una vendita a sconto.'); }
      if(li.outlet>2){ A = Math.max(0, A-20); crit.push('Parla di outlet o sconti forti.'); }
    }
    if(li && terzi){
      A = li.marchio>0 ? 85 : 45;
      if(li.marchio>0) perche.push('Sul sito parla di collezione propria, produzione o showroom.');
      if(li.italia>0){ A = Math.min(100, A+10); perche.push('Parla già di made in Italy.'); }
    }
    if(A==null) manca.push(terzi ? 'Se ha una collezione sua da far produrre: lo dice solo il suo sito, non ancora letto.'
                                 : 'Che marchi tratta e a che prezzi: lo dice solo il suo sito, non ancora letto.');
    ind.A = A;

    // B · vende uomo e maglieria: il tipo dice molto, il sito precisa
    let B = t.base;
    if(li){
      if(li.uomo>0 && l.type!=='uomo') B += 10;
      if(li.maglia>0){ B += 10; perche.push('Sul sito parla di maglieria, polo o cashmere.'); }
      if(li.italia>0 && !terzi){ B += 5; perche.push('Parla di made in Italy.'); }
      if(li.donna>0 && !li.uomo && !terzi){ B -= 30; crit.push('Sul sito si parla solo di donna.'); }
      if(li.sartoria>0 && !terzi) perche.push('Fa anche su misura: cliente attento alla qualità del capo.');
    }
    ind.B = Math.max(0, Math.min(100, B));

    // E · come contattarlo. All'estero l'email è il canale del buyer, poi WhatsApp e Instagram
    ind.E = l.canale===0?100 : l.canale===1?80 : l.canale===2?70 : l.canale===3?45 : 0;
    if(l.canale===3) crit.push('Solo telefono: niente email né WhatsApp.');

    let s=0, w=0;
    for(const k of Object.keys(PESI)) if(ind[k]!=null){ s+=ind[k]*PESI[k]; w+=PESI[k]; }
    let lead = w ? Math.round(s/w) : 0;

    // chi vende già marchi di fascia alta sta sopra a chi ha solo prezzi alti o un sito non letto
    if(li && !terzi && li.marchiMaglia.length){ lead = Math.min(100, lead+8); }
    else if(li && !terzi && li.marchiUomo.length){ lead = Math.min(100, lead+4); }
    // senza sito letto non sappiamo la cosa che conta di più: resta sotto chi è confermato dal sito
    if(A==null){ lead = Math.min(lead, 70); crit.push('Punteggio provvisorio: il sito non è stato letto.'); }
    const catena = (l.sedi||1)>=2;
    if(catena){ lead = Math.min(100, lead+5); perche.push('Ha più negozi: un ordine, più vetrine.'); }
    if(li && li.negozio>0 && !terzi){ lead = Math.min(100, lead+3); perche.push('Vende anche online.'); }
    const scaffale = !!(li && (li.marchiMaglia.length + li.marchiUomo.length) > 0);
    // il sito e' stato letto ma non parla di abbigliamento (uomo, donna, maglieria, sartoria): non e' un negozio di moda
    if(li && !terzi && (li.uomo + li.donna + li.maglia + li.sartoria)===0){ lead = Math.min(lead, 30); crit.push('Il sito non sembra quello di un negozio di moda.'); }
    // senza nessun marchio di fascia alta confermato dal sito non si va oltre «Da valutare» (controllo a vista del 23/11: nella fascia 58-71 solo 1 negozio su 20 era davvero giusto)
    else if(li && !terzi && !scaffale && lead>57){ lead = 57; crit.push('Nessun marchio di fascia alta riconosciuto sul sito: non è confermato che sia in fascia.'); }
    const classe = lead>=72?'hi' : lead>=58?'mid' : lead>=42?'val' : 'low';
    return {lead, classe, ind, pesi:PESI, nomi:terzi?NOMI_M:NOMI, perche, manca, crit, catena, scaffale, conf:Math.round(100*w)};
  }

  window.MA_PUNTEGGIO = {TIPI, NOMI, PESI, calcola, pulisci};
})();
