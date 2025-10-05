export enum Chord {
    Major,
    Minor,
    Seventh,
    MajorSeventh,
    MinorSeventh,
    MajorSixth,
    MinorSixth,
    Diminished,
    Augmented,
}

export enum Inversion {
    Root,
    First,
    Second,
}

const chordNotesMap: Record<Chord, number[]> = {
    [Chord.Major]: [0, 4, 7],
    [Chord.Minor]: [0, 3, 7],
    [Chord.Seventh]: [0, 4, 7, 10],
    [Chord.MajorSeventh]: [0, 4, 7, 11],
    [Chord.MinorSeventh]: [0, 3, 7, 10],
    [Chord.MajorSixth]: [0, 4, 7, 9],
    [Chord.MinorSixth]: [0, 3, 7, 9],
    [Chord.Diminished]: [0, 3, 6],
    [Chord.Augmented]: [0, 4, 8],
};

export function notesInChord(
    start: number,
    chordType: Chord,
    inversion: Inversion = Inversion.Root,) {
    let notes = chordNotesMap[chordType];
    notes = notes.map((n) => n + start);
    applyInversion(notes, inversion);
    return notes;
}

function applyInversion(notes, inversion: Inversion) {
    if (notes.length == 0) {
        return;
    }
    switch (inversion) {
        case Inversion.First:
            notes[0] += 12;
            break;
        case Inversion.Second:
            notes[0] += 12;
            notes[1] += 12;
            break;
    }
}

const majorKeyOffsets = [0, 2, 4, 5, 7, 9, 11, 12];

export function getNotesInKey(root: number) {
    return majorKeyOffsets.map((x) => x + root);
}

export function getNthNoteInKey(root: number, n: number) {
    let notes = getNotesInKey(root);
    return notes[n];
}

export function noteToPositionInKey(root: number, note: number, isSingleNoteMode: boolean = false) {
    if (isSingleNoteMode) {
        return null;
    }
    let offset = (note - root) % 12;
    if (offset < 0) offset += 12;
    const positionInKey = majorKeyOffsets.indexOf(offset)
    if (positionInKey >= 0) {
        return positionInKey + 1;
    } else {
        return null;
    }
}