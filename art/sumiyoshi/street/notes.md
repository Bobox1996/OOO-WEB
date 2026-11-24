# Sumiyoshi street exterior

## Architectural evidence

- Tadao Ando Architect & Associates dates the concrete house to 1976 and describes the insertion into the middle of three terraced wooden dwellings. The firm's photographs show the uninterrupted upper façade and entrance recess. [Architect's exhibition](https://artsandculture.google.com/story/row-house-in-sumiyoshi-a-stronghold-for-the-independent-urban-dweller/RgXR5cYQ-WUWEw) · [Street photograph](https://artsandculture.google.com/asset/row-house-sumiyoshi-0004/yQEvAu05hJ7-CA)
- Imamura Souhei gives a 3.5 m street frontage, a 6 m wall, a depth of about 14 m and an entrance opening of 0.8 × 2.3 m. These dimensions set the scale of the central mesh in the game. [Japan Economic Foundation, *Little Houses in a Big City*, p. 1](https://www.jef.or.jp/journal/pdf/architecture0307.pdf)
- Street views published by METALOCUS and Dacian Groza's photographs in ArchEyes show close party lines, pale cladding and shallow eaves to the left as seen from the street, a taller right neighbour, overhead wiring and pots at the concrete entry. The photos document different moments in the life of the street. [METALOCUS, 2021](https://www.metalocus.es/en/news/row-house-sumiyoshi-azuma-house-tadao-ando) · [ArchEyes photographs](https://archeyes.com/row-house-by-tadao-ando-azuma-house-light-space-concrete/)

## Game street

The centre wall is at Z = 0. X increases to the visitor's right and positive Z faces the street. The entrance passes between the two front piers. The playable interior loads separately at the threshold. A central open court and two roof volumes also express the plan from an elevated exterior camera.

The nine game plots span roughly 48 metres. The first neighbours borrow forms from the street photographs. The wider parcels, roof pitches, other six buildings, power lines, paving, vending machine, planting and signage are an original game composition. These elements have no surveyed dimensions. The second plot on the left, between X = −15.4 and −8.2 m, is reserved for the separate café model. The three-dimensional model and its material textures are authored for OOO. No photographic textures are copied from the references.

## Models

Run `make_street.py` in Blender's background mode. The script writes an editable scene next to itself, plus `street.glb` and `cola.glb` in the public model directory. The bottle exports separately with its base at the origin, its label facing positive Z, and a physical height of 0.30 m.
