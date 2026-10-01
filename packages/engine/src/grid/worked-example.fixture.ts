/**
 * The worked example from docs/design.md → Grid format, character for
 * character. Tests across the engine use it as a known-good chunk.
 */
export const WORKED_EXAMPLE = `CHUNK meter=3/4 tempo=66 key=Db
P1 key=Db I dyn=p tex=nocturne-arp motif=A
P2 key=Db vi tex=nocturne-arp motif=A:seq
P3 key=Db IV dyn=mp< tex=nocturne-arp
P4 key=Db V7 cad=HC dyn=mp> tex=nocturne-arp
B1 R: F5@0:24 Eb5@24:6 Db5@30:6 | L: Db2@0:6 Ab2@6:6 F3@12:6 Ab3@18:6 Db4@24:6 Ab3@30:6 | ped: c0
B2 R: Db5@0:12 C5@12:4 Db5@16:4 Eb5@20:4 F5@24:12 | L: Bb1@0:6 F2@6:6 Db3@12:6 F3@18:6 Bb3@24:12 | ped: c0
B3 R: Db5+Gb5+Bb5@0:24 Ab5@24:12~ | L: Gb1@0:6 Db2@6:6 Bb2@12:6 Db3@18:6 Gb3@24:12 | ped: c0
B4 R: Ab5@0:12 Gb5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:6 Gb3@18:6 Ab3@24:12 | ped: c0 | t: rit
HOLD
H1 R: Gb5@0:12 F5@12:12 Eb5@24:12 | L: Ab1@0:6 Eb2@6:6 C3@12:24 | ped: c0
H2 R: Eb5@0:24 C5@24:12 | L: Ab1@0:6 Eb2@6:6 Gb2@12:24 | ped: c0
F key=Db chord=V7 ped=down
F sum The nocturne opens in Db: theme A sung over wide arpeggios, rising to a half cadence.
F theme A F5@0:24 Eb5@24:6 Db5@30:6
F road Bbm:darker Gb:warmer Db:home
END
`;
