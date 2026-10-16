# 星空数据来源

## 星表 / 星座线 / 名字
- 来源：d3-celestial（https://github.com/ofrohn/d3-celestial ，Olaf Frohn），BSD 3-Clause，许可全文 d3-celestial-LICENSE.txt。
  - data/stars.6.json（Hipparcos 星表派生，星等≤6；本项目只留≤5.5 等，共 2851 颗）
  - data/constellations.lines.json（88 星座连线；巨蛇座两段合为一条）
  - data/starnames.json（中文星官名，取前 110 颗亮星；「萁宿」改正为「箕宿」）
  - data/constellations.json（星座标签位置 display）
- 改动：RA 由 -180..180 换成 0..360 度；星座名换成简体（d3 原为繁体）；常用星名（天狼星、织女星、牛郎星、北极星、北斗七星等 35 个）人工覆盖。
- 星座小故事（23 条）是本项目自己写的，无外部来源。
- 深空天体坐标 J2000、视大小、距离为常用公开值（SIMBAD / 维基百科常见数值），仅为事实数据。

## 深空照片（data/img/<id>.jpg）
全部来自 Wikimedia Commons（各条目的英文维基首图），已缩到长边 1024px、JPEG q85。
署名要求：CC BY / CC BY-SA 的图在前端展示时需带作者署名和许可（catalog.deep[].credit / license / source 已带上）；CC BY-SA 的 M27 若被改编需同许可分享。Public domain / CC0 无要求。

| id | 许可 | 作者 / 署名 | 原始页面 |
|---|---|---|---|
| M1 | Public domain | NASA, ESA, J. Hester and A. Loll (Arizona State University) | https://commons.wikimedia.org/wiki/File:Crab_Nebula.jpg |
| M8 | CC BY 4.0 | ESO/VPHAS+ team | https://commons.wikimedia.org/wiki/File:VST_images_the_Lagoon_Nebula.jpg |
| M13 | CC0 | Chuck Ayoub | https://commons.wikimedia.org/wiki/File:M13-Globular-Cluster.png |
| M16 | CC BY 4.0 | ESO | https://commons.wikimedia.org/wiki/File:Eagle_Nebula_from_ESO.jpg |
| M17 | CC BY 4.0 | ESO/INAF-VST/OmegaCAM. Acknowledgement: OmegaCen/Astro-WISE/Kapteyn Institute | https://commons.wikimedia.org/wiki/File:VST_image_of_the_spectacular_star-forming_region_Messier_17_(Omega_Nebula).jpg |
| M20 | CC BY 4.0 | RubinObs/NOIRLab/SLAC/NSF/DOE/AURA | https://commons.wikimedia.org/wiki/File:Trifid_Nebula_(noirlab2521ah).jpg |
| M27 | CC BY-SA 4.0 | Alpha Zhang (AstroBin: shyzhang127) | https://commons.wikimedia.org/wiki/File:Messier_27_(1).jpg |
| M31 | CC0 | Brody Wesner | https://commons.wikimedia.org/wiki/File:Andromeda_Galaxy_2025.png |
| M33 | CC BY 4.0 | ESO | https://commons.wikimedia.org/wiki/File:VST_snaps_a_very_detailed_view_of_the_Triangulum_Galaxy.jpg |
| M42 | Public domain | NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team | https://commons.wikimedia.org/wiki/File:Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg |
| M44 | CC0 | Chuck Ayoub | https://commons.wikimedia.org/wiki/File:M44-Star-Cluster.png |
| M45 | Public domain | NASA, ESA, AURA/Caltech, Palomar Observatory The science team consists of: D. Soderblom and E. Nelan (STScI), F. Benedict and B. Arthur (U. Texas), and B. Jones (Lick Obs.) | https://commons.wikimedia.org/wiki/File:Pleiades_large.jpg |
| M51 | Public domain | NASA and European Space Agency | https://commons.wikimedia.org/wiki/File:Messier51_sRGB.jpg |
| M57 | CC BY 4.0 | ESA/Webb, NASA, CSA, M. Barlow, N. Cox, R. Wesson | https://commons.wikimedia.org/wiki/File:Webb_captures_detailed_beauty_of_Ring_Nebula_(NIRCam_image)_(weic2320b).jpg |
| M81 | Public domain | NASA, ESA and the Hubble Heritage Team (STScI/AURA) | https://commons.wikimedia.org/wiki/File:Messier_81_HST.jpg |
| M87 | Public domain | en:NASA, en:STScI, en:WikiSky | https://commons.wikimedia.org/wiki/File:Messier_87_Hubble_WikiSky.jpg |
| M101 | CC BY 4.0 | Credit: Image: European Space Agency & NASA Acknowledgements: Project Investigators for the original Hubble data: K.D. Kuntz (GSFC), F. Bresolin (University of Hawaii), J. Trauger (JPL), J. Mould  | https://commons.wikimedia.org/wiki/File:M101_hires_STScI-PRC2006-10a.jpg |
| M104 | CC BY 4.0 | ESA/Hubble & NASA, K. Noll | https://commons.wikimedia.org/wiki/File:Sombrero_Galaxy_(heic2506a).jpg |

## 天文计算
- astronomy-engine（https://github.com/cosinekitty/astronomy ，MIT），单文件放在 engine/vendor/astronomy.js（文件头带 MIT 许可全文）。

