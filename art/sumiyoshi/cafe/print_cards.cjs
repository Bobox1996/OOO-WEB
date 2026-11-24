// House-printed cards for the Sumiyoshi coffee room. Rebuild with Node + sharp.
const sharp=require('sharp')
const path=require('node:path')
const c={wine:'#582f2d',clay:'#b65a46',cream:'#efdbb9',green:'#3c5346',black:'#302e29',gold:'#d4ac70',sage:'#93a482'}
const txt=(x,y,n,t,fc=c.cream,bold=400,anchor='start',space=0)=>'<text x="'+x+'" y="'+y+'" fill="'+fc+'" font-family="Georgia, serif" font-size="'+n+'" font-weight="'+bold+'" text-anchor="'+anchor+'" letter-spacing="'+space+'">'+t+'</text>'
const line=(d,color,w=1,fill='none')=>'<path d="'+d+'" stroke="'+color+'" stroke-width="'+w+'" fill="'+fill+'" stroke-linecap="round"/>'
const box=(x,y,w,h,fc)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fc+'"/>'
const circ=(x,y,r,fc)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fc+'"/>'
const frame=(fc=c.gold)=>line('M10 10H190V230H10Z',fc,.85)
const leaf=(x,y,a,s,fg)=>'<g transform="translate('+x+' '+y+') rotate('+a+') scale('+s+')">'+line('M0 0Q-15 -22 0 -49Q14 -23 0 0Z',fg,.7,fg)+line('M0 -1L0 -43',c.cream,.7)+'</g>'
const sprig=(x,y,s,color)=>'<g transform="translate('+x+' '+y+') scale('+s+')">'+line('M0 0Q14 -38 23 -100',color,1.7)+
  [[6,-24,-51,.56],[11,-41,47,.49],[14,-52,-47,.50],[17,-64,34,.43],[20,-77,-32,.40]].map(v=>leaf(...v,color)).join('')+'</g>'
const cup=(x,y,s,fg)=>'<g transform="translate('+x+' '+y+') scale('+s+')">'+line('M-24 -12H19L13 10Q-1 22 -17 10Z',fg,1.9)+line('M19 -9Q37 -15 28 0Q23 6 16 6 M-28 17Q0 24 26 16 M-10 -18Q-17 -27 -8 -34 M2 -20Q-4 -27 5 -39',fg,2)+'</g>'
const badge=(x,y,s,fg)=>'<g transform="translate('+x+' '+y+') scale('+s+')">'+[0,10,20].map(dx=>'<ellipse cx="'+dx+'" cy="0" rx="9" ry="13" transform="rotate(28 '+dx+' 0)" stroke="'+fg+'" stroke-width="1.9" fill="none"/>').join('')+'</g>'
const menu=box(0,0,200,240,c.green)+frame()+txt(100,30,8,'S U M I Y O S H I',c.cream,400,'middle')+txt(100,60,24,'COFFEE',c.cream,400,'middle',2)+
 line('M25 71H175',c.gold)+[['HOUSE BLEND','550'],['ESPRESSO','450'],['KISSATEN LATTE','600'],['GARDEN TEA','550'],['TOAST SET','750']].map(([n,v],i)=>txt(24,92+i*22,9,n)+txt(175,92+i*22,10,v,c.cream,400,'end')).join('')+
 cup(98,202,.57,c.gold)+txt(100,224,7,'O U T   O F   O F F I C E',c.cream,400,'middle')
const poster=box(0,0,200,240,c.cream)+frame(c.clay)+txt(23,37,12,'BOTANICAL STUDIES',c.green,400,'start',1.3)+
 sprig(79,188,1.06,c.green)+sprig(102,181,.72,c.sage)+txt(22,208,13,'Forest House',c.black)+txt(22,223,7,'O/O/O  ·  FIELD PLATE  01',c.clay)
const name=box(0,0,200,240,c.cream)+frame(c.clay)+badge(86,53,.74,c.clay)+txt(100,101,17,'F O R E S T',c.wine,400,'middle')+
 txt(100,128,24,'HOUSE',c.wine,400,'middle',3)+txt(100,153,13,'COFFEE BAR',c.green,400,'middle')+line('M42 172H158',c.clay,.8)+txt(100,198,9,'SUMIYOSHI',c.black,400,'middle',2)+txt(100,216,7,'O/O/O   ATELIER',c.wine,400,'middle')
const evening=box(0,0,200,240,c.wine)+frame()+txt(100,34,8,'O U T   O F   O F F I C E',c.cream,400,'middle')+
 circ(140,88,22,c.gold)+line('M20 166Q64 111 93 134Q132 102 180 134V170H20Z',c.green,0,c.green)+line('M20 176Q61 143 95 154Q144 126 180 149V182H20Z',c.clay,0,c.clay)+
 txt(22,205,19,'Evening roast',c.cream)+txt(22,220,7,'COFFEE AFTER THE RAIN',c.cream)
const cards=[menu,poster,name,evening]
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="310">'+cards.map((art,i)=>'<svg x="'+i*260+'" width="260" height="310" viewBox="0 0 200 240">'+art+'</svg>').join('')+'</svg>'
sharp(Buffer.from(svg)).png({palette:true,colours:110}).toFile(path.join(__dirname,'paper.png')).catch(e=>{console.error(e);process.exitCode=1})
