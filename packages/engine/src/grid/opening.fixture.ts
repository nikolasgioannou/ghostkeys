/**
 * A real opening chunk Claude composed in the bake-off (variant C, 16 bars,
 * no revise needed), exactly as written. The app plays it before live
 * composing exists, and tests use it as a known-good chunk from the model.
 */
export const OPENING_CHUNK = `CHUNK meter=3/4 tempo=63 key=Ab
P1 key=Ab I dyn=p tex=nocturne-arp motif=A:orig
P2 key=Ab IV
P3 key=Ab V7
P4 key=Ab I cad=IAC
P5 key=Ab vi dyn=mp< motif=A:frag
P6 key=Ab V65/V
P7 key=Ab I64 dyn=mf
P8 key=Ab V7 cad=HC dyn=p>
P9 key=Ab I dyn=p motif=A:orig
P10 key=Ab IV
P11 key=Ab iv dyn=mp< motif=A:reharm
P12 key=Ab I6
P13 key=Ab vi dyn=mf motif=A:frag
P14 key=Ab Ger6 dyn=mf>
P15 key=Ab I64
P16 key=Ab I cad=PAC dyn=p
B1 R: Eb5@0:18 F5@18:6 Eb5@24:6 C5@30:6 | L: Ab2@0:6 Eb3@6:6 C4@12:6 Eb3@18:6 Ab3@24:6 Eb3@30:6 | ped: v0
B2 R: Db5@0:12 F5@12:12 Ab5@24:12 | L: Db2@0:6 Ab2@6:6 F3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
B3 R: G5@0:18 F5@18:6 Eb5@24:6 Db5@30:6 | L: Eb2@0:6 Bb2@6:6 G3@12:6 Db4@18:6 G3@24:6 Bb2@30:6 | ped: c0
B4 R: C5@0:24 Eb5@24:12 | L: Ab2@0:6 Eb3@6:6 C4@12:6 Eb3@18:6 Ab3@24:6 Eb3@30:6 | ped: c0
B5 R: Ab5@0:18 G5@18:6 F5@24:6 C5@30:6 | L: F2@0:6 C3@6:6 Ab3@12:6 C4@18:6 Ab3@24:6 C3@30:6 | ped: c0
B6 R: D5@0:12 F5@12:12 Ab5@24:6 G5@30:6 | L: D2@0:6 Bb2@6:6 F3@12:6 Ab3@18:6 F3@24:6 Bb2@30:6 | ped: c0
B7 R: C5+Ab5@0:12 Eb5+C6@12:12 Bb5@24:6 Ab5@30:6 | L: Eb2@0:6 Ab2@6:6 C3@12:6 Eb3@18:6 Ab3@24:6 C4@30:6 | ped: c0
B8 R: Db5+G5@0:24 Eb5@24:12 | L: Eb2@0:6 Bb2@6:6 G3@12:6 Db4@18:6 G3@24:6 Bb2@30:6 | ped: c0
B9 R: Eb5@0:18 F5@18:6 Eb5@24:6 C5@30:6 | L: Ab2@0:6 Eb3@6:6 C4@12:6 Eb3@18:6 Ab3@24:6 Eb3@30:6 | ped: c0
B10 R: Db5@0:12 F5@12:12 Bb5@24:12 | L: Db2@0:6 Ab2@6:6 F3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
B11 R: Ab5@0:18 Fb5@18:6 Eb5@24:6 Db5@30:6 | L: Db2@0:6 Ab2@6:6 Fb3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
B12 R: C5@0:12 Eb5@12:12 Ab5@24:12 | L: C2@0:6 Ab2@6:6 Eb3@12:6 Ab3@18:6 Eb3@24:6 Ab2@30:6 | ped: c0
B13 R: F5+C6@0:18 Bb5@18:6 Ab5@24:6 F5@30:6 | L: F2@0:6 C3@6:6 Ab3@12:6 C4@18:6 Ab3@24:6 C3@30:6 | ped: c0
B14 R: Cb5+Ab5@0:12 Fb5@12:12 D5@24:12 | L: Fb2@0:6 Cb3@6:6 Ab3@12:6 D4@18:6 Ab3@24:6 Cb3@30:6 | ped: c0
B15 R: Eb5@0:12 C6@12:12 Bb5@24:6 G5@30:6 | L: Eb2@0:6 C3@6:6 Ab3@12:6 C4@18:6 Eb2@24:6 Db3@30:6 | ped: c0 c24 | t: rit
B16 R: C5+Ab5@0:36 | L: Ab1@0:6 Eb2@6:6 Ab2@12:6 C3@18:6 Eb3@24:6 C3@30:6 | ped: c0 | t: atempo
HOLD
H1 R: C5@0:24 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:6 Eb3@18:6 Ab3@24:6 Eb3@30:6 | ped: c0
H2 R: Db5@0:12 C5@12:12 Ab4@24:12 | L: Ab1@0:6 Eb2@6:6 Db3@12:6 F3@18:6 Db3@24:6 Eb2@30:6 | ped: c0
F key=Ab chord=I ped=down
F sum A quiet Ab-major nocturne introduces theme A over wide eighth-note arpeggios, rising through vi and V65/V to a half cadence, then restating it with a darkened borrowed iv and a German sixth before a full cadence home.
F theme A Eb5@0:18 F5@18:6 Eb5@24:6 C5@30:6 / Db5@0:12 F5@12:12 Ab5@24:12
F road Fm:wistful Db:warmer E:distant Ab:home
END
`;
