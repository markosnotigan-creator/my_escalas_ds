
import React, { useState, useMemo, useEffect } from 'react';
import { Roster, Rank } from '../../types';
import { db } from '../../services/store';
import { Printer, Download, Loader2, FileText, ZoomIn, ZoomOut, Monitor, RotateCw } from 'lucide-react';

interface PrintPreviewProps {
  roster: Roster;
  onClose: () => void;
}

// Helper para ordenação de patentes
const getRankWeight = (rank: string) => {
  const map: Record<string, number> = {
    [Rank.CEL]: 1, 
    [Rank.TEN_CEL]: 2, 
    [Rank.MAJ]: 3, 
    [Rank.CAP]: 4, 
    [Rank.TEN_1]: 5, 
    [Rank.TEN_2]: 6,
    [Rank.ASP]: 7, 
    [Rank.SUBTEN]: 8, 
    [Rank.SGT_1]: 9, 
    [Rank.SGT_2]: 10, 
    [Rank.SGT_3]: 11,
    [Rank.CB]: 12, 
    [Rank.SD]: 13, 
    [Rank.CIVIL]: 14
  };
  return map[rank] || 99;
};

// Helper para abreviar patentes
const getAbbreviatedRank = (rank: string) => {
  const map: Record<string, string> = {
    [Rank.CEL]: 'Cel', 
    [Rank.TEN_CEL]: 'TC', 
    [Rank.MAJ]: 'Maj', 
    [Rank.CAP]: 'Cap', 
    [Rank.TEN_1]: '1ºTen', 
    [Rank.TEN_2]: '2ºTen',
    [Rank.ASP]: 'Asp', 
    [Rank.SUBTEN]: 'ST', 
    [Rank.SGT_1]: '1ºSgt', 
    [Rank.SGT_2]: '2ºSgt', 
    [Rank.SGT_3]: '3ºSgt', 
    [Rank.CB]: 'Cb', 
    [Rank.SD]: 'Sd', 
    [Rank.CIVIL]: 'Civ'
  };
  return map[rank] || rank;
};

export const PrintPreview: React.FC<PrintPreviewProps> = ({ roster, onClose }) => {
  const settings = db.getSettings();
  const allSoldiers = db.getSoldiers();
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.8); // Zoom inicial
  
  const isExtra = roster.type === 'cat_extra';
  
  // Categorias específicas que usam layout vertical (Operational)
  const isAmbOrPsi = roster.type === 'cat_amb' || roster.type === 'cat_psi';
  
  // Todo o resto (Adm, Ast, Novas Personalizadas) usa layout Grade Paisagem
  const isGrid = !isExtra && !isAmbOrPsi;
  
  // PADRÃO AGORA É PAISAGEM (LANDSCAPE)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Ajuste automático ao abrir
  useEffect(() => {
    handleFitToScreen();
  }, [orientation]);

  const handleFitToScreen = () => {
    const screenHeight = window.innerHeight;
    // Altura base A4 Landscape (794px a 96dpi) vs Portrait (1123px)
    const contentHeight = orientation === 'portrait' ? 1123 : 794; 
    const fitZoom = (screenHeight - 140) / contentHeight; 
    setZoomLevel(Math.max(0.4, Math.min(fitZoom, 1.2)));
  };

  const toggleOrientation = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  // Processamento de dados para Escala Extra (Lista)
  const extraRosterData = useMemo(() => {
    if (!isExtra) return [];
    
    const validShifts = roster.shifts.filter(s => s.soldierId);
    const list = validShifts.map(shift => {
      const soldier = allSoldiers.find(s => s.id === shift.soldierId);
      return { shift, soldier };
    }).filter(item => item.soldier) as { shift: any, soldier: typeof allSoldiers[0] }[];

    return list.sort((a, b) => {
      const weightA = getRankWeight(a.soldier.rank);
      const weightB = getRankWeight(b.soldier.rank);
      if (weightA !== weightB) return weightA - weightB;
      return a.soldier.name.localeCompare(b.soldier.name);
    });
  }, [roster, allSoldiers, isExtra]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('roster-pdf-content');
    if (!element) return;
    setIsGenerating(true);
    
    const originalStyle = element.getAttribute('style');
    element.style.transform = 'none';
    element.style.margin = '0';

    const opt = {
      margin: 0, 
      filename: `Escala_${roster.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
    };

    try {
      // @ts-ignore
      await window.html2pdf().set(opt).from(element).save();
    } catch (e) { 
      alert("Erro ao gerar PDF."); 
      console.error(e);
    }
    finally { 
      setIsGenerating(false); 
      if (originalStyle) element.setAttribute('style', originalStyle);
      handleFitToScreen();
    }
  };

  // GERAÇÃO DAS DATAS
  const dates = [];
  let curr = new Date(roster.startDate + 'T12:00:00');
  const end = new Date(roster.endDate + 'T12:00:00');
  while(curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

  const creationDateFormatted = roster.creationDate 
    ? new Date(roster.creationDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Headers dinâmicos para Extra
  const HEADERS = roster.customHeaders || ['ORDEM', 'POST/GRADUAÇÃO', 'NUMERO', 'NOME COMPLETO', 'MATRICULA', 'CELULAR'];

  // Helper de Renderização de Célula Extra (Similar ao Editor)
  const renderExtraCell = (headerName: string, item: any, colIndex: number) => {
    const h = headerName.toUpperCase();
    const s = item.soldier;

    if (h.includes('GRAD') || h.includes('POSTO')) return getAbbreviatedRank(s.rank);
    if (h.includes('COMPLETO')) return <span className="text-[9px] font-bold text-left block pl-2">{s.fullName || s.name}</span>;
    if (h.includes('NOME')) return <div className="text-left pl-2 font-bold uppercase truncate">{s.name}</div>;
    if (h === 'NUMERO' || h.includes('NUMERO') || h.includes('NUMERAL')) return s.matricula || '-';
    if (h.includes('MATRICULA') || h.includes('MATRÍCULA') || h === 'MF' || h === 'M.F' || h.includes('FUNCIONAL')) return s.mf || '-';
    if (h === 'MAT' || h === 'MAT.' || h === 'NUM' || h === 'NUM.') return s.matricula || '-';
    if (h.includes('CEL') || h.includes('TEL')) return s.phone || '-';
    if (h.includes('FUN') || h.includes('CARGO')) return <span className="text-[10px]">{s.role}</span>;
    if (h.includes('SETOR') || h.includes('UNIDADE') || h.includes('LOTA')) return <span className="text-[10px]">{s.sector}</span>;
    if (h.includes('SIT') || h.includes('STATUS')) return <span className="text-[9px] font-bold">{s.status}</span>;
    if (h === 'NR' || h === 'NR.' || h === 'OBS') {
        return item.shift.customData?.[colIndex] !== undefined ? item.shift.customData[colIndex] : (item.shift.note || '-');
    }
    return item.shift.customData?.[colIndex.toString()] || '-';
  };

  const containerClass = orientation === 'landscape' 
    ? "w-[297mm] h-[210mm] overflow-hidden" 
    : "w-[210mm] h-[297mm] overflow-hidden";

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 overflow-hidden no-print flex flex-col backdrop-blur-sm animate-in fade-in duration-200">
      <style>{`
        @media print {
          @page { 
            size: ${orientation} A4; 
            margin: 0; 
          }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
            background: white; 
            margin: 0; 
            padding: 0;
          }
          #roster-pdf-content { 
            width: 100% !important; 
            height: 100% !important; 
            box-shadow: none !important; 
            margin: 0 !important;
            transform: none !important;
            page-break-inside: avoid;
            page-break-after: avoid;
            overflow: hidden !important;
          }
          .no-print-internal { display: none !important; }
        }
      `}</style>

      {/* Barra de Ferramentas */}
      <div className="bg-gray-800 p-3 text-white flex justify-between items-center sticky top-0 z-50 border-b border-gray-700 shadow-xl no-print-internal">
        <div className="flex items-center space-x-4">
           <h2 className="font-bold flex items-center space-x-2 text-base"><FileText size={20}/> <span className="hidden md:inline">Visualização de Impressão</span></h2>
           <button 
             onClick={toggleOrientation}
             className={`px-3 py-1 rounded text-xs font-bold uppercase flex items-center space-x-2 transition-all hover:scale-105 ${orientation === 'portrait' ? 'bg-purple-600' : 'bg-blue-600'}`}
             title="Clique para alternar orientação"
           >
             <RotateCw size={14} />
             <span>{orientation === 'portrait' ? 'Retrato (A4)' : 'Paisagem (A4)'}</span>
           </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-gray-700 rounded-lg p-1 mr-2">
            <button onClick={() => setZoomLevel(z => Math.max(0.3, z - 0.1))} className="p-1.5 hover:text-blue-300 hover:bg-gray-600 rounded transition"><ZoomOut size={16}/></button>
            <span className="text-xs font-mono w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))} className="p-1.5 hover:text-blue-300 hover:bg-gray-600 rounded transition"><ZoomIn size={16}/></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={handleFitToScreen} className="p-1.5 hover:text-green-300 hover:bg-gray-600 rounded transition" title="Ajustar à Tela"><Monitor size={16}/></button>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-bold uppercase transition">Voltar</button>
          <button onClick={handleDownloadPDF} disabled={isGenerating} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded font-bold flex items-center text-xs shadow-md transition uppercase">
            {isGenerating ? <Loader2 className="animate-spin mr-1" size={14}/> : <Download className="mr-1" size={14}/>} PDF
          </button>
          <button onClick={() => window.print()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded font-bold flex items-center text-xs shadow-md transition uppercase">
            <Printer className="mr-1" size={14}/> Imprimir
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-600/50 p-4 md:p-8 flex justify-center items-start">
        <div 
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          className="transition-transform duration-200 ease-out origin-top will-change-transform bg-white shadow-2xl"
        >
          {isExtra ? (
            <div id="roster-pdf-content" className={containerClass} style={{ padding: '15mm', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: 'white' }}>
                <div className="h-full flex flex-col">
                    <header className="flex justify-between items-start mb-4 h-16 relative w-full flex-shrink-0">
                        {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="h-16 w-auto object-contain" alt="PMCE" />}
                        <div className="flex-1"></div>
                        {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="h-16 w-auto object-contain" alt="Gov" />}
                    </header>
                    <div className="text-center mb-2 flex-shrink-0">
                        <h1 className="text-[14pt] font-bold uppercase leading-tight">{roster.title}</h1>
                    </div>
                    <div className="mb-2 text-[9pt] text-left flex-shrink-0">
                        <span className="font-bold">APRESENTAÇÃO:</span> <span className="uppercase">{roster.observations}</span>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <table className="w-full border-collapse border border-black text-[11pt] table-auto">
                            <thead>
                              <tr className="bg-[#e6e6e6]">
                                {HEADERS.map((h, i) => (
                                   <th key={i} className="border border-black p-1 text-center font-bold px-2">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {extraRosterData.slice(0, 28).map((item, index) => (
                                <tr key={item.soldier.id}>
                                  {HEADERS.map((header, colIndex) => (
                                     <td key={colIndex} className="border border-black p-0.5 text-center">
                                        {header.includes('ORD') ? (
                                           <span className="font-bold">{(index + 1).toString().padStart(2, '0')}</span>
                                        ) : (
                                           renderExtraCell(header, item, colIndex)
                                        )}
                                     </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="text-right text-[10pt] mb-4 mt-2 font-bold flex-shrink-0">{settings.city}, {creationDateFormatted}</div>
                    <div className="text-center mb-2 flex-shrink-0">
                         <div className="w-1/3 mx-auto border-b border-black mb-1"></div>
                         <p className="font-bold uppercase text-[9pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                         <p className="uppercase text-[8pt] leading-none mt-1">{settings.directorRole}</p>
                         <p className="uppercase text-[8pt] leading-none mt-1">{settings.directorMatricula}</p> 
                    </div>
                </div>
            </div>
          ) : isGrid ? (
            <div id="roster-pdf-content" className={containerClass} style={{ padding: '10mm', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: 'white' }}>
               <div className="h-full flex flex-col">
                  <header className="text-center mb-2 flex flex-col justify-center border-b border-black/20 pb-1 relative h-12 flex-shrink-0">
                     {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="absolute left-0 top-0 h-12 w-12 object-contain" alt="Logo Esq" />}
                     <div className="mx-16">
                       {/* TÍTULO DA ORGANIZAÇÃO (AGORA PERSONALIZÁVEL) */}
                       <h1 className="text-[10pt] font-bold uppercase tracking-wide text-gray-800">
                         {roster.headerTitle || settings.orgName}
                       </h1>
                       <h2 className="text-[12pt] font-black uppercase tracking-tight leading-tight">{roster.title}</h2>
                       <div className="text-[8pt] font-bold uppercase">DO DIA {new Date(roster.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} A {new Date(roster.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                     </div>
                     {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="absolute right-0 top-0 h-12 w-12 object-contain" alt="Logo Dir" />}
                  </header>
                  <div className="flex-1 border border-black overflow-hidden relative">
                    <table className="w-full h-full border-collapse text-[8pt] table-fixed">
                       <thead>
                          <tr className="h-8">
                             <th className="border border-black bg-[#cbd5b0] p-1 w-32"></th>
                             {dates.map(d => (
                                <th key={d.toISOString()} className="border border-black bg-[#e4e9d6] p-1 text-center uppercase">
                                   <div className="font-bold">{['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'][d.getDay()]} {d.getDate().toString().padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}</div>
                                </th>
                             ))}
                          </tr>
                       </thead>
                       <tbody>
                          {(roster.sections || []).flatMap(sec => sec.rows).map((row) => (
                             <tr key={row.id}>
                                <td className="border border-black bg-[#cbd5b0] p-2 font-bold uppercase text-center align-middle whitespace-pre-wrap leading-tight text-[8pt]">
                                   {row.label}
                                </td>
                                {dates.map(d => {
                                   const dStr = d.toISOString().split('T')[0];
                                   const shiftsInCell = roster.shifts.filter(s => s.date === dStr && s.period === row.id);
                                   return (
                                      <td key={`${row.id}-${dStr}`} className="border border-black p-1 align-top text-center h-auto">
                                         <div className="flex flex-col space-y-1">
                                            {shiftsInCell.length > 0 ? shiftsInCell.map((shift, i) => {
                                               const sdr = allSoldiers.find(s => s.id === shift.soldierId);
                                               // IMPRESSÃO GRADE (ADM/AST/CUSTOM): Só mostra a nota preenchida na lacuna
                                               const legend = shift.note || '';
                                               return sdr ? (
                                                  <div key={i} className="text-[7pt] font-bold uppercase leading-tight">
                                                     {getAbbreviatedRank(sdr.rank)} {sdr.matricula ? sdr.matricula + ' ' : ''}{sdr.name} {legend && <span className="ml-0.5 text-blue-800 font-black">{legend}</span>}
                                                  </div>
                                               ) : null;
                                            }) : <span className="text-[6pt] text-gray-300 font-bold">***</span>}
                                         </div>
                                      </td>
                                   );
                                })}
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[8pt] relative flex-shrink-0">
                     <div className="flex w-full mb-1 border border-black p-1 bg-white">
                         <div className="w-1/2 pr-1 border-r border-black">
                             <span className="font-bold uppercase block text-[7pt] mb-0.5">OBSERVAÇÕES:</span> 
                             <div className="uppercase leading-tight">{roster.observations}</div>
                         </div>
                         <div className="w-1/2 pl-1">
                             <span className="font-bold uppercase block text-[7pt] mb-0.5">ALTERAÇÕES:</span>
                             <div className="uppercase leading-tight">{roster.situationText || 'Sem alterações.'}</div>
                         </div>
                     </div>
                     <div className="text-right font-bold mt-1">{settings.city}, {creationDateFormatted}</div>
                     <div className="text-center w-1/3 mx-auto mt-2">
                        <div className="w-full border-b border-black mb-0.5"></div>
                        <p className="font-bold uppercase text-[8pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                        <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorRole}</p>
                        <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorMatricula}</p> 
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            <div id="roster-pdf-content" className={containerClass} style={{ padding: '10mm', fontFamily: 'Arial, Helvetica, sans-serif', backgroundColor: 'white' }}>
                <div className="h-full flex flex-col">
                    <header className="text-center mb-1 relative h-12 flex items-center justify-center flex-shrink-0">
                       {settings.showLogoLeft && settings.logoLeft && <img src={settings.logoLeft} className="absolute left-0 top-0 h-12 w-12 object-contain" alt="Logo Esq" />}
                       <div className="mx-14 w-full">
                         {/* TÍTULO EDITÁVEL DA ORGANIZAÇÃO (AMBULÂNCIA/PSICOLOGIA) */}
                         <h1 className="text-[8pt] font-bold uppercase tracking-tight leading-none mb-1">
                            {roster.headerTitle || settings.orgName}
                         </h1>
                         <h2 className="text-[10pt] font-black uppercase leading-none mb-1">{roster.title}</h2>
                         <div className="text-[7pt] font-bold uppercase bg-black text-white inline-block px-2 rounded-sm leading-tight">
                             PERÍODO: {new Date(roster.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} A {new Date(roster.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                       </div>
                       {settings.showLogoRight && settings.logoRight && <img src={settings.logoRight} className="absolute right-0 top-0 h-12 w-12 object-contain" alt="Logo Dir" />}
                    </header>
                    {roster.subTitle && (
                        <div className="bg-[#cbd5b0] border border-black border-b-0 p-0.5 text-center font-bold text-[7pt] uppercase mb-0 flex-shrink-0">
                            {roster.subTitle}
                        </div>
                    )}
                    <div className="flex-1 border border-black relative flex flex-col overflow-hidden">
                       <table className="w-full h-full table-fixed border-collapse">
                          <thead>
                            <tr className="h-6">
                               {dates.map((d) => (
                                  <th key={d.toISOString()} className="bg-[#e4e9d6] border border-black p-0 text-center w-[14.28%]">
                                     <div className="font-black text-[7pt] uppercase leading-none">{['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()]}</div>
                                     <div className="text-[6pt] font-bold leading-none mt-0.5">{d.getDate().toString().padStart(2,'0')}/{String(d.getMonth()+1).padStart(2,'0')}</div>
                                  </th>
                               ))}
                            </tr>
                          </thead>
                          <tbody>
                             {(roster.sections || []).map((sec, sIdx) => (
                                <React.Fragment key={sIdx}>
                                   <tr className="h-4 bg-[#cbd5b0]">
                                      <td colSpan={dates.length} className="border border-black p-0 text-center font-bold text-[7pt] uppercase tracking-wide leading-none align-middle">
                                         {sec.title}
                                      </td>
                                   </tr>
                                   {sec.rows.map((row) => (
                                      <tr key={row.id}>
                                         {dates.map((d) => {
                                            const dStr = d.toISOString().split('T')[0];
                                            const shift = roster.shifts.find(s => s.date === dStr && s.period === row.id);
                                            const sdr = shift ? allSoldiers.find(s => s.id === shift.soldierId) : null;
                                            const legend = shift?.note || '';
                                            return (
                                              <td key={`${row.id}-${dStr}`} className="border border-black p-0 text-center align-middle h-auto">
                                                 {sdr ? (
                                                    <div className="flex flex-col items-center justify-center w-full h-full leading-none px-0.5 py-0.5">
                                                       <div className="text-[8.5pt] font-bold uppercase text-center w-full break-words tracking-tight leading-tight">
                                                         {getAbbreviatedRank(sdr.rank)} {sdr.matricula || ''} {sdr.name.split(' ')[0]}
                                                       </div>
                                                       <div className="text-[7pt] font-bold text-gray-600 mt-0.5 scale-90 leading-tight">{sdr.phone || '-'}</div>
                                                       {legend && (
                                                         <div className="text-[7pt] font-black text-blue-800 mt-0.5 scale-90 leading-tight">{legend}</div>
                                                       )}
                                                    </div>
                                                 ) : <span className="text-[6pt] text-gray-300">-</span>}
                                              </td>
                                            );
                                         })}
                                      </tr>
                                   ))}
                                </React.Fragment>
                             ))}
                          </tbody>
                       </table>
                    </div>
                    <div className="mt-1 flex flex-col justify-end h-auto flex-shrink-0">
                         <div className="flex w-full mb-1 border-b border-black/10 pb-1">
                             <div className="w-1/2 pr-1 border-r border-black/10">
                                 <div className="text-[6pt] leading-tight">
                                    <span className="font-bold uppercase block text-[6pt] text-gray-500 mb-0.5">{roster.observationsTitle || 'OBS'}:</span> 
                                    {roster.observations}
                                 </div>
                             </div>
                             <div className="w-1/2 pl-1">
                                 <div className="text-[6pt] leading-tight">
                                    <span className="font-bold uppercase block text-[6pt] text-gray-500 mb-0.5">ALTERAÇÕES:</span>
                                    {roster.situationText || 'Sem alterações.'}
                                 </div>
                             </div>
                         </div>
                        <div className="relative mt-1">
                            <div className="absolute right-0 top-0 text-[7pt] font-bold">
                                {settings.city}, {creationDateFormatted}
                            </div>
                            <div className="text-center w-1/3 mx-auto mt-2">
                                <div className="w-full border-b border-black mb-0.5"></div>
                                <p className="font-bold uppercase text-[7pt] leading-none">{settings.directorName} – {settings.directorRank}</p>
                                <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorRole}</p>
                                <p className="uppercase text-[7pt] leading-none mt-1">{settings.directorMatricula}</p> 
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
