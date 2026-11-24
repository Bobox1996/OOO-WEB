// Rebuild the original Night Mart print sheet with node art/drive-in/shop/make_prints.cjs.
// The Blender master packs the rendered sheet and preserves the editable display objects.
const path = require('node:path')
const sharp = require('sharp')

const ink = '#202f35', ivory = '#fff4cf', teal = '#147772', red = '#bd403d'
const butter = '#efb83f', blue = '#357f9a', moss = '#789454', rose = '#ed9484'
const rect = (x,y,w,h,c,rx=0) => '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+c+'"/>'
const circle = (x,y,r,c) => '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/>'
const pathEl = (d,c,stroke='none',weight=1) => '<path d="'+d+'" fill="'+c+'" stroke="'+stroke+'" stroke-width="'+weight+'" stroke-linecap="round" stroke-linejoin="round"/>'
const type = (x,y,size,c,txt,weight=700,anchor='start',tracking=0) =>
  '<text x="'+x+'" y="'+y+'" fill="'+c+'" font-family="Arial, sans-serif" font-size="'+size+'" font-weight="'+weight+'" text-anchor="'+anchor+'" letter-spacing="'+tracking+'">'+txt+'</text>'
const many = (n,f) => Array.from({length:n},(_,i)=>f(i)).join('')
const fine = (x,y,w,c) => many(4,i=>rect(x,y+i*3,w*(i===3?.63:1),.8,c))
const issue = (word,c=ink) => type(11,18,8,c,'O/O/O   EDITIONS',700,'start',1.2)+type(168,18,8,c,word,700,'end')
const barcode = (x,y) => rect(x,y,35,12,ivory)+many(13,i=>rect(x+3+i*2.25,y+2,(i%3)*.5+.5,7,ink))
const leaf = (x,y,scale,mirror) => '<g transform="translate('+x+' '+y+') scale('+(scale*(mirror?-1:1))+' '+scale+')">'+pathEl('M0 0 Q16 -17 19 -37 Q-2 -32 0 0Z',moss)+pathEl('M0 0 Q9 -15 17 -31','none',ink,1)+'</g>'
const rice = (x,y,s) => '<g transform="translate('+x+' '+y+') scale('+s+')">'+
  pathEl('M-44 23 Q-48 17 -42 6 L-10 -40 Q-2 -51 7 -41 L42 7 Q51 23 35 26 L-30 29 Q-41 29 -44 23Z',ivory,ink,2)+
  pathEl('M-13 4 Q-2 1 12 3 L16 26 L-13 27Z',ink)+
  [[-27,8],[-20,-5],[-6,-23],[4,-18],[17,-1],[27,11],[-32,17]].map(([a,b])=>pathEl('M'+a+' '+b+'l3 -1','none','#b79b71',1.6)).join('')+'</g>'
const cup = (x,y,s) => '<g transform="translate('+x+' '+y+') scale('+s+')">'+
  pathEl('M-25 -19 L18 -19 L13 13 Q0 25 -17 13Z',ivory,ink,2)+
  pathEl('M18 -15 Q38 -21 29 -5 Q25 2 15 2','none',ivory,5)+
  pathEl('M-28 19 Q-1 27 27 17','none',ivory,3)+
  pathEl('M-11 -26 Q-17 -35 -10 -40 M1 -27 Q-4 -35 6 -44','none',ivory,2)+'</g>'
const lemon = (x,y,r) => circle(x,y,r,'#f4c23b')+circle(x,y,r*.85,ivory)+
  many(8,i=>'<g transform="translate('+x+' '+y+') rotate('+i*45+') scale('+r/40+')">'+pathEl('M3 -4 L7 -31 Q19 -31 25 -22 L6 -4Z','#e99b39')+'</g>')
const pine = (x,y,s,c) => '<g transform="translate('+x+' '+y+') scale('+s+')">'+pathEl('M0 -20 L-8 -6 L-5 -6 L-13 8 L-8 8 L-17 20 L-2 20 L-2 27 L2 27 L2 20 L17 20 L8 8 L12 8 L5 -6 L8 -6Z',c)+'</g>'

const cells = [
  [180,230, rect(0,0,180,230,'#e1dfad')+issue('NO. 08')+type(10,52,32,ink,'FIELD')+type(10,77,23,ink,'NOTES',400,'start',3)+
    pathEl('M48 197 Q81 137 124 68 M64 167 Q46 139 44 125 M82 139 Q111 143 134 118','none',ink,2)+
    [[62,170,.72,1],[69,158,.68,0],[79,144,.67,1],[90,128,.60,0],[101,113,.51,1],[111,96,.47,0],[116,86,.42,1],[49,140,.45,1],[114,137,.47,0]].map(a=>leaf(...a)).join('')+
    type(12,207,10,ink,'FERNS OF THE RIDGE')+fine(12,215,61,ink)+barcode(137,207)],
  [180,230, rect(0,0,180,230,'#e8aaa0')+issue('VOL. 03')+type(11,66,48,ink,'FORM')+
    pathEl('M15 155 L83 112 L159 151 L92 196Z',red)+pathEl('M35 130 L83 101 L83 147 L35 176Z',ivory)+
    pathEl('M84 100 L142 128 L142 173 L84 146Z',teal)+
    many(7,i=>pathEl('M'+(37+i*6)+' '+(132-i*3.7)+'v36','none',ink,1.4))+
    pathEl('M15 155 L92 194 L159 151 M142 128 L84 100 L35 130','none',ink,1.4)+
    type(10,213,9,ink,'SMALL HOUSES   /   ISSUE 3')+barcode(136,207)],
  [180,230, rect(0,0,180,230,'#494561')+issue('NO. 12',ivory)+type(9,62,46,ivory,'DUSK')+
    circle(130,101,24,'#f1ce83')+pathEl('M0 153 Q40 119 77 128 T180 117 V230 H0Z','#898398')+
    pathEl('M0 178 Q40 138 75 156 T180 141 V230 H0Z','#596e79')+
    many(13,i=>pine(i*16-7,184-9*Math.sin(i),.48+(i*13%7)/15,'#273f47'))+
    pathEl('M0 198 Q55 188 105 198 T180 187 V230 H0Z','#273f47')+
    type(11,217,9,ivory,'THE NIGHT SCREEN ISSUE')+barcode(136,206)],
  [180,230, rect(0,0,180,230,'#f5d264')+issue('04 / EAT')+type(9,60,43,'#254459','TABLE')+
    circle(92,139,52,'#ece2b0')+circle(92,139,45,blue)+circle(92,139,38,'#c5764c')+
    many(6,i=>pathEl('M'+(64+i*3)+' '+(129+i*5)+'q23 -12 38 -1t17 -4','none','#f5d17a',2.3))+
    circle(109,131,12,ivory)+circle(109,131,6,butter)+circle(78,151,4,teal)+circle(75,142,3,teal)+
    pathEl('M111 125 L157 77 M116 131 L160 85','none',ink,3)+type(12,211,10,ink,'NOODLES AFTER HOURS')+barcode(135,205)],
  [180,230, rect(0,0,180,230,ink)+issue('35 MM',ivory)+type(10,56,40,'#f4a477','FRAME')+
    rect(13,77,154,94,'#d58e70')+many(10,i=>rect(17+i*15,80,6,5,ink,1)+rect(17+i*15,160,6,5,ink,1))+
    rect(22,89,64,66,'#93bcb0')+rect(94,89,64,66,'#eabf83')+
    pathEl('M22 155 L42 116 L52 128 L66 108 L85 155Z','#467a72')+circle(68,103,7,ivory)+
    pathEl('M94 155 V135 L109 128 V116 H120 V141 L136 131 V110 L149 107 V136 L158 131 V155Z','#a95649')+
    type(12,193,13,ivory,'CONTACT SHEETS')+fine(13,203,82,ivory)+barcode(135,204)],
  [180,230, rect(0,0,180,230,'#95c7bc')+issue('ISSUE 07')+type(10,55,37,ink,'OUTSIDE')+
    many(35,i=>pathEl('M'+((i*43)%178)+' '+(72+(i*19)%113)+'l-3 9','none',ivory,1))+
    pathEl('M20 141 Q51 88 97 120 Q119 109 148 138 Q134 129 120 143 Q106 132 93 145 Q77 135 63 149 Q46 138 30 148Z',red,ink,2)+
    pathEl('M82 139 L70 176 Q68 190 58 183 M35 143 Q63 110 93 116','none',ink,2.5)+
    type(12,209,10,ink,'THE RAIN ALMANAC')+barcode(134,204)],
  [200,238, rect(0,0,200,238,'#c44e39')+rect(8,8,184,222,'#eab457')+
    rect(13,13,174,212,'#c44e39')+type(100,34,10,ivory,'N I G H T   M A R T',700,'middle')+
    type(100,64,29,ivory,'ONIGIRI',900,'middle')+circle(99,122,54,'#ecaa46')+rice(106,130,1.07)+
    type(99,199,13,ivory,'HAND WRAPPED',700,'middle',1)+type(99,216,8,ivory,'HOT FOOD   /   NIGHT SHIFT',700,'middle')],
  [200,238, rect(0,0,200,238,'#255852')+circle(158,40,51,'#356d65')+
    type(17,33,9,'#dfc884','O/O/O   COFFEE COUNTER',700,'start',1)+type(16,67,27,ivory,'MIDNIGHT')+
    type(17,94,25,'#dbab69','ROAST')+cup(100,146,1.28)+
    type(18,206,14,ivory,'FRESHLY BREWED')+fine(18,214,100,'#d4ba90')],
  [200,238, rect(0,0,200,238,blue)+type(15,30,9,ivory,'OOO   /   COLD PANTRY',700,'start',1)+
    type(15,66,32,ivory,'CITRUS')+type(15,91,19,ivory,'SODA CLUB',700,'start',2)+
    many(9,i=>circle(12+i*23,110+i*17%70,2+i%3,'#a2d2cb'))+lemon(115,152,43)+lemon(66,177,28)+
    type(17,221,10,ivory,'SQUEEZED   /   CHILLED')],
  [460,105, rect(0,0,460,105,'#b94834')+rect(5,5,450,95,'#ebc37c')+rect(8,8,444,89,'#b94834')+
    rice(54,59,.77)+type(106,38,13,'#fbd198','OOO  /  NIGHT MART',700,'start',2)+
    type(104,78,36,ivory,'HOT FOOD')+type(345,48,12,ivory,'FRESHLY')+type(345,66,12,ivory,'WRAPPED')],
  [420,100, rect(0,0,420,100,'#245b55')+rect(6,8,408,84,'#dfcf9a')+rect(9,11,402,78,'#245b55')+
    cup(49,55,.74)+type(92,38,12,'#ebcc95','OUT OF OFFICE',700,'start',2)+
    type(90,73,28,ivory,'NIGHT REGISTER')+type(383,63,24,'#dfb36c','01',700,'middle')],
  [330,90, rect(0,0,330,90,'#d4b57f')+rect(5,5,320,80,ink)+
    type(15,32,10,'#e0c799','PERIODICALS  /  OOO',700,'start',1)+type(14,66,26,ivory,'PRINT ROOM')+
    pathEl('M265 22 L304 19 L309 62 L270 69Z',rose)+pathEl('M253 25 L292 22 L299 66 L259 71Z',teal)+
    pathEl('M243 28 L281 25 L288 68 L248 74Z',ivory)+pathEl('M250 40l24 -3m-21 10l20 -2','none',ink,2)]
]

async function main(){
  const width=300,height=348,cols=4
  const content=cells.map(([vw,vh,art],i)=>
    '<svg x="'+(i%cols*width)+'" y="'+(Math.floor(i/cols)*height)+'" width="'+width+'" height="'+height+
    '" viewBox="0 0 '+vw+' '+vh+'" preserveAspectRatio="none">'+art+'</svg>').join('')
  const xml='<svg xmlns="http://www.w3.org/2000/svg" width="'+cols*width+'" height="'+3*height+'">'+content+'</svg>'
  await sharp(Buffer.from(xml)).png({palette:true,colours:180}).toFile(path.join(__dirname,'night-mart-print.png'))
}
main().catch(e=>{console.error(e); process.exitCode=1})
