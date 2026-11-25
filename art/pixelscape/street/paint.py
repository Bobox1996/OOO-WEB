"""Draw the Sumiyoshi street atlas at its native pixel scale, with no external libraries."""
import math
import random
import struct
import zlib

from botany import botanical_tiles


def rgb(hex_color):
    if not isinstance(hex_color, str):
        return tuple(hex_color)
    return tuple(bytes.fromhex(hex_color.lstrip('#')))


def shift(color, n):
    return tuple(min(255, max(0, c + n)) for c in rgb(color)[:3])


class Paper:
    def __init__(self, width, height, color):
        self.w, self.h = width, height
        self.pixels = bytearray(self.rgba(color) * (width * height))

    @staticmethod
    def rgba(c):
        c = bytes(rgb(c))
        return c if len(c) == 4 else c + bytes([255])

    def rect(self, x, y, w, h, c):
        a,b=max(0,round(x)),max(0,round(y))
        X,Y=min(self.w,round(x+w)),min(self.h,round(y+h))
        if X <= a or Y <= b:
            return
        strip=self.rgba(c)*(X-a)
        for j in range(b,Y):
            off=(j*self.w+a)*4
            self.pixels[off:off+len(strip)]=strip

    def line(self, x1, y1, x2, y2, color, thickness=1):
        n=max(abs(round(x2-x1)),abs(round(y2-y1)),1)
        for j in range(n+1):
            t=j/n
            self.rect(x1+(x2-x1)*t,y1+(y2-y1)*t,thickness,thickness,color)

    def circle(self,x,y,rx,ry,color):
        for i in range(-ry,ry+1):
            dx=round(rx*math.sqrt(max(0,1-(i/max(1,ry))**2)))
            self.rect(x-dx,y+i,2*dx+1,1,color)

    def paste(self,other,x,y):
        for j in range(other.h):
            a=((j+y)*self.w+x)*4
            self.pixels[a:a+4*other.w]=other.pixels[j*other.w*4:(j+1)*other.w*4]

    def save(self,path):
        def chunk(k,v):
            return struct.pack('>I',len(v))+k+v+struct.pack('>I',zlib.crc32(k+v)&0xffffffff)
        scan=b''.join(b'\0'+self.pixels[r*self.w*4:(r+1)*self.w*4] for r in range(self.h))
        path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))


def skin(index):
    rng=random.Random(90 + index)
    base=['3f524f','536161','3e5051','536266','3e534f','5d4a43','405557','677576'][index]
    d=Paper(216,192,base)
    # Different claddings age differently: panel siding, limewash, brick, raw concrete.
    for _ in range(150):
        x=rng.randrange(d.w);y=rng.randrange(d.h)
        d.rect(x,y,rng.randrange(3,22),rng.randrange(1,10),shift(base,rng.choice([-4,-3,2,3])))
    if index == 7:
        for y in range(0,d.h,29):
            d.rect(0,y,d.w,1,shift(base,-15))
            d.rect(0,y+1,d.w,1,shift(base,4))
            for x in range(-54 if (y//29)%2 else 0,d.w,108):
                d.rect(x,y,1,30,shift(base,-12))
                for i in [13,93]:
                    d.rect(x+i,y+7,2,2,shift(base,-27))
                    d.rect(x+i+1,y+8,1,1,shift(base,8))
                    d.rect(x+i,y+21,2,1,shift(base,-24))
    elif index in (1,5):
        for y in range(0,192,5):
            off=7 if y%10 else 0
            d.rect(0,y,216,1,shift(base,-9))
            for x in range(off,216,14): d.rect(x,y,1,5,shift(base,-10))
    elif index in (0,2,4,6):
        for y in range(0,192,7 if index%2 else 5):
            d.rect(0,y,216,1,shift(base,-11))
            d.rect(0,y+1,216,1,shift(base,5))
        for x in range(7,216,59):
            d.rect(x,0,2,192,shift(base,-13))
    for _ in range(90):
        x=rng.randrange(d.w);y=rng.randrange(d.h)
        d.rect(x,y,1,rng.randint(2,18),shift(base,rng.randrange(-10,2)))
    return d


def shop(index):
    rng=random.Random(8721+index);d=Paper(128,106,'564938')
    d.rect(0,0,128,19,'8a8362');d.rect(4,4,119,2,'c1b686');d.rect(16,5,70,3,'f8dda0')
    d.rect(3,19,124,62,'6b6e55');d.rect(0,26,128,3,'353e36')
    # Lit boxes, tea tins and bottles; packages cluster by product and rack.
    colors=['d0ab57','d6bf8a','9c6e47','b56a4e','8c9b78','778e86','b4c4a3','9b9970']
    for r in range(3):
        y=35+r*17
        x=-2
        while x<130:
            count=rng.randint(2,5);w=rng.randint(3,7);h=rng.randint(7,12)
            col=rng.choice(colors)
            for j in range(count):
                if index%2 or j%3:
                    d.rect(x+1,y+11-h,w-1,h,col)
                    d.rect(x+1,y+12-h,w-1,1,shift(col,18))
                    d.rect(x+2,y+8,w-2,1,shift(col,-29))
                else:
                    d.rect(x+2,y+2,2,3,'c9b282');d.rect(x+1,y+5,4,6,col)
                x+=w
        d.rect(0,y+12,128,2,'bfad84');d.rect(0,y+14,128,2,'404c41')
        for x in range(rng.randint(0,5),128,11):d.rect(x,y+12,3,2,'dfd5ad')
    for x in (0,43,87,125):
        d.rect(x,22,2,65,'424539');d.rect(x+1,22,1,65,'a0926f')
    # Hanging order slips and red tea labels help the eye read the scale of a packet.
    for x,w,c in [(7,12,'b45e48'),(42,11,'b9985a'),(85,15,'829884')]:
        d.rect(x,9,w,16,c);d.rect(x+2,12,w-4,2,'e8c899');d.rect(x+3,17,w-6,1,'5f5842')
    for x in (15,50,78,93):
        d.rect(x,48,3,8,'d65c47');d.rect(x+1,51,2,3,'e7ca9a')
    d.rect(0,86,128,3,'d1b783');d.rect(0,89,128,17,'806243')
    for x in range(2,128,18):
        d.rect(x,90,1,16,'674936');d.rect(x+2,91,12,1,'97774e')
    return d


def window(index):
    rng=random.Random(1071+index)
    warm=index in (1,3,5)
    pal=('5e5142','aa8664','b6a17e','c4ad84','715e50','f2cd8c') if warm else ('253f45','375356','435d5d','486765','293e44','73948b')
    d=Paper(80,68,pal[0])
    d.rect(0,4,80,58,pal[1]);d.rect(1,7,78,49,pal[2]);d.rect(1,8,9,49,pal[1])
    if index in (0,1,2,3):
        for x in range(0,80,3):
            t=x/80
            length=28+int(18*abs(math.cos(t*4)))+rng.randrange(0,3)
            d.rect(x,5,3,length,pal[2 if (x//3)%3 else 3]);d.rect(x,5,1,length,pal[1])
        d.rect(36,11,1,33,pal[4]);d.rect(0,5,80,2,pal[4])
        for j in range(19):
            y=8+j*2;mid=round(35+math.sin(j*.10)*5)
            d.rect(mid,y,3+(j//4),2,pal[0])
        d.rect(51,42,11,9,pal[4]);d.rect(49,52,16,2,pal[0])
        if index==3:
            for x in (2,21,40,59,78):d.rect(x,4,1,53,pal[4])
            for y in range(14,58,8):d.rect(1,y,78,1,pal[1])
    else:
        d.rect(9,17,15,23,pal[4]);d.rect(11,19,11,18,pal[3]);d.rect(12,20,9,4,pal[1])
        for yy in (27,30,33):d.rect(13,yy,6,1,pal[1])
        d.rect(43,31,28,21,pal[4])
        for s in range(3):
            for j in range(7):
                d.rect(44+4*j,33+s*7,2,rng.randint(2,5),pal[rng.choice((1,2,3))])
        d.line(18,53,25,43,pal[4],2);d.circle(23,42,5,3,pal[4])
        d.rect(4,52,27,3,pal[4]);d.rect(8,55,2,3,pal[4])
        d.rect(24,47,7,5,pal[4]);d.line(27,47,29,40,pal[4]);d.circle(30,40,4,2,pal[4])
    d.rect(0,57,80,11,pal[0]);d.rect(0,56,80,2,pal[4])
    if warm:d.rect(25,7,29,2,pal[5])
    return d


def printed():
    d=Paper(64,82,'b9ae88')
    d.rect(1,1,62,80,'7e806e');d.rect(2,2,60,78,'d0c3a0')
    d.rect(4,5,56,21,'617e72');d.rect(7,8,24,2,'c6c4a1')
    d.rect(7,13,43,2,'d5c4a3');d.rect(7,17,16,2,'d5c4a3')
    d.rect(6,30,22,19,'85968b');d.circle(17,39,6,7,'b8ba9e')
    d.rect(34,31,22,3,'a2604b')
    for j,w in enumerate([18,12,20,13]):d.rect(34,37+j*3,w,1,'7b7967')
    for j in range(4):
        d.rect(7,55+j*5,50,1,'9d957c')
        for x in range(7,58,8):d.rect(x,55+j*5,1,5,'a69b7f')
    d.rect(8,75,16,2,'92765e')
    return d


def tower(index):
    rng=random.Random(987+index)
    cols=['354865','3c4a63','413f50','344962','3c4559','354462'];base=cols[index]
    d=Paper(126,192,base)
    for floor in range(11):
        y=10+16*floor
        d.rect(0,y,126,2,shift(base,-9));d.rect(0,y+2,126,1,shift(base,11))
        for col in range(5):
            x=6+24*col;r=rng.random()
            d.rect(x-1,y+4,16,10,'293647')
            tint=rng.choice(('bc986f','b89a77','d9b47f')) if r<.095 else rng.choice(('2a3647','41516a','536279','33485e','465469'))
            d.rect(x,y+5,13,8,tint);d.rect(x+6,y+5,1,8,'354255')
            if r<.09:d.rect(x,y+8,13,1,shift(tint,-23))
            if floor%4==1 and col%2==0:
                d.rect(x+12,y+9,7,4,'566177');d.rect(x+13,y+10,4,1,'34465b')
        if (index+floor)%3:
            d.rect(1,y+12,124,1,shift(base,10));d.rect(3,y+14,120,2,shift(base,-8))
            for i in range(4,126,6):d.rect(i,y+12,1,3,shift(base,5))
    for x in (2,49,117):d.rect(x,2,2,188,shift(base,-8))
    d.rect(0,0,126,2,shift(base,16))
    return d


def road():
    d=Paper(192,192,'273d41');rng=random.Random(201)
    for j in range(2100):
        x=rng.randrange(192);y=rng.randrange(192)
        d.rect(x,y,rng.choice([1,1,2,3,5]),1,rng.choice(['293f43','2e4447','22383c','263b40','32484a']))
    for j in range(35):
        x=rng.randrange(192);y=rng.randrange(192)
        d.rect(x,y,rng.randint(3,9),1,'354c4d')
    return d


def sky():
    d=Paper(416,168,'263a63');rng=random.Random(84)
    for y in range(d.h):
        t=y/(d.h-1);r=round(27+t*23);g=round(45+t*32);b=round(77+t*32)
        d.rect(0,y,416,1,(r,g,b))
    for y,radius,col in [(102,64,'354d67'),(91,51,'304862'),(52,35,'293e5e'),(26,27,'263954')]:
        x=-90
        while x<460:
            r=rng.randint(radius//3,radius)
            d.circle(x,y+rng.randrange(-5,7),r,rng.randint(2,8),col);x+=rng.randint(10,59)
    return d


def atlas(path,pigments=()):
    tiles={**{f'skin{i}':skin(i) for i in range(8)},**{f'room{i}':window(i) for i in range(6)},
           **{f'shop{i}':shop(i) for i in range(2)},**{f'tower{i}':tower(i) for i in range(6)},
           **botanical_tiles(Paper),'road':road(),'sky':sky(),'notice':printed()}
    chips=Paper(128,128,'263c41')
    if len(pigments)>256:raise ValueError('Palette exceeds sixteen by sixteen swatches')
    for i,c in enumerate(pigments):chips.rect(i%16*8,i//16*8,8,8,c)
    tiles['chips']=chips
    x=y=2;row=0;placement={}
    for k,im in tiles.items():
        if x+im.w+2>1024:x=2;y+=row+3;row=0
        placement[k]=(x,y,im.w,im.h)
        row=max(row,im.h);x+=im.w+3
    h=2**math.ceil(math.log2(y+row+2))
    sheet=Paper(1024,h,'263c41')
    for k,im in tiles.items():sheet.paste(im,*placement[k][:2])
    sheet.save(path)
    return placement,(1024,h)
