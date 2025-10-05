<script lang="ts">
    export let octaves = 2;
    export let keysPressed = [];
    export let verbose;

    import Key from "./Key.svelte";
    import { onMount } from "svelte";
    import MIDI from "midi.js";
    import {
        Chord,
        getNotesInKey,
        getNthNoteInKey,
        Inversion,
        notesInChord,
        noteToPositionInKey,
    } from "./chords";

    let notes;
    let singleNoteMode = false;

    let minRootNote = 48;
    let maxRootRote = 72;
    let rootNote = 60;
    let positionInKey;
    let pickedN;
    let playable = true;
    let randomRoot = false;

    $: {
        let start = 0;
        let finish = octaves * 12 + 1;
        const isRootNatural = ![1, 3, 6, 8, 10].includes(rootNote % 12);
        if (!isRootNatural) {
            start -= 1;
            finish += 1;
        }
        const arr = Array.from({ length: finish - start }, (_, a) => a + start);
        notes = arr.map((i) => i + (rootNote - Math.floor(octaves / 2) * 12));
    }

    let logs = [];

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    function midiToKey(note: number) {
        if (note < notes[0]) {
            note += 12 * octaves;
        }
        let octave = Math.floor(note / (12 * octaves));
        let offset = (note - rootNote) % (12 * octaves);
        if (octave % (octaves + 1) == 0 && (offset == 0 || offset == 1)) {
            // need this because we add in 1 extra note of the one we start on
            return 12 * octaves + offset;
        } else {
            return offset;
        }
    }

    function noteOn(
        note: number,
        velocity: number = 127,
        checkPlayable = true,
    ) {
        if (checkPlayable && !playable) {
            return;
        }
        logs = [`Note ${note} was pressed!`, ...logs];
        let positionInKeyPressed = noteToPositionInKey(rootNote, note);
        if (positionInKey) {
            if (!positionInKeyPressed) {
                return;
            }
            if (positionInKeyPressed === positionInKey) {
                positionInKey = undefined;
                playable = false;

                setTimeout(async () => {
                    let notesInKey = getNotesInKey(rootNote);
                    let notesToPlay: number[];
                    if (positionInKeyPressed >= 5) {
                        notesToPlay = notesInKey.slice(
                            positionInKeyPressed - 1,
                        );
                    } else {
                        notesToPlay = notesInKey.slice(0, positionInKeyPressed);
                        notesToPlay.reverse();
                    }
                    if (notesToPlay.length == 1 && note != rootNote) {
                        notesToPlay = [note];
                    }
                    let firstNote = true;
                    for (const note of notesToPlay) {
                        noteOn(note, 127, false);
                        let time = firstNote ? 500 : 300;
                        keyBindings[midiToKey(note)]?.markCorrect(time);
                        await sleep(time);
                        noteOff(note);
                        firstNote = false;
                    }
                    playable = true;
                }, 0);
                return;
            } else {
                keyBindings[midiToKey(note)]?.markWrong();
            }
        }
        MIDI.noteOn(0, note, velocity, 0);
        let key = midiToKey(note);
        keyBindings[key]?.playKey();
    }

    function noteOff(note: number) {
        logs = [`Note ${note} was released!`, ...logs];
        MIDI.noteOff(0, note, 0);
        let key = midiToKey(note);
        keyBindings[key]?.stopPlayingKey();
    }

    function listInputsAndOutputs(midiAccess: WebMidi.MIDIAccess) {
        for (const entry of midiAccess.inputs) {
            const input = entry[1];
            console.log(
                "Input port [type:'" +
                    input.type +
                    "'] id:'" +
                    input.id +
                    "' manufacturer:'" +
                    input.manufacturer +
                    "' name:'" +
                    input.name +
                    "' version:'" +
                    input.version +
                    "'",
            );
        }

        for (const entry of midiAccess.outputs) {
            const output = entry[1];
            console.log(
                "Output port [type:'" +
                    output.type +
                    "'] id:'" +
                    output.id +
                    "' manufacturer:'" +
                    output.manufacturer +
                    "' name:'" +
                    output.name +
                    "' version:'" +
                    output.version +
                    "'",
            );
        }
    }

    function onMIDIMessage(event: WebMidi.MIDIMessageEvent) {
        if (verbose) {
            let str =
                "MIDI message received at timestamp " +
                event.timeStamp +
                "[" +
                event.data.length +
                " bytes]: ";
            for (let i = 0; i < event.data.length; i++) {
                str += "0x" + event.data[i].toString(16) + " ";
                event.data;
            }
            console.log(str);
        }

        const command = event.data[0];
        const note = keyBindings[midiToKey(event.data[1])]?.getNote();
        const velocity = event.data.length > 2 ? event.data[2] : 0; // a velocity value might not be included with a noteOff command

        switch (command) {
            case 144: // noteOn
                if (velocity > 0) {
                    noteOn(note);
                } else {
                    noteOff(note);
                }
                break;
            case 128: // noteOff
                noteOff(note);
                break;
            // we could easily expand this switch statement to cover other types of commands such as controllers or sysex
        }
    }

    onMount(async () => {
        MIDI.loadPlugin({
            soundfontUrl: "./soundfont/",
            instrument: "acoustic_grand_piano",
            onprogress: function (state, progress) {
                console.log(state, progress);
            },
            onsuccess: function () {
                MIDI.setVolume(0, 127);
            },
        });
        try {
            let midiAccess = await navigator.requestMIDIAccess();
            console.log("MIDI ready!");
            if (verbose) listInputsAndOutputs(midiAccess);
            midiAccess.inputs.forEach((entry) => {
                entry.onmidimessage = onMIDIMessage;
            });
        } catch (err) {
            console.log("Failed to get MIDI access - " + err);
        }
    });

    let keyBindings: Record<number, Key> = {};

    let innerWidth: number;
    $: keyWidth = Math.min((innerWidth - 36 / octaves) / (octaves * 8), 56);

    function chordOn(
        start: number,
        type: Chord = Chord.Major,
        inversion: Inversion = Inversion.Root,
    ) {
        chordOnOrOff(start, type, true, inversion);
    }

    function chordOff(
        start: number,
        type: Chord = Chord.Major,
        inversion: Inversion = Inversion.Root,
    ) {
        chordOnOrOff(start, type, false, inversion);
    }

    function chordOnOrOff(
        start: number,
        chordType: Chord,
        play: boolean,
        inversion: Inversion,
    ) {
        let chordNotes = notesInChord(start, chordType, inversion);
        chordNotes.forEach((note) => {
            if (play) {
                noteOn(note, 127, false);
            } else {
                noteOff(note);
            }
        });
    }

    async function playPattern(newNoteToGuess) {
        playable = false;
        const positionInKeyBefore = positionInKey;
        positionInKey = undefined;
        if (newNoteToGuess && randomRoot) {
            rootNote =
                Math.floor(Math.random() * (maxRootRote - minRootNote)) +
                minRootNote;
        }

        let hold = 500;
        let pause = 100;
        if (!singleNoteMode) {
            let chords = [
                [0, Chord.Major, Inversion.Root],
                [5 - 12, Chord.Major, Inversion.Second],
                [7 - 12, Chord.Major, Inversion.First],
                [0, Chord.Major, Inversion.Root],
            ];
            for (const [offset, chordType, inversion] of chords) {
                chordOn(rootNote + offset, chordType, inversion);
                await sleep(hold);
                chordOff(rootNote + offset, chordType, inversion);
                await sleep(pause);
            }
            await sleep(hold);
        }
        if (newNoteToGuess) {
            pickedN = Math.floor(Math.random() * 8);
            positionInKey = pickedN + 1;
            if (positionInKey === 8) {
                positionInKey = 1;
            }
        } else {
            positionInKey = positionInKeyBefore;
        }

        let note = getNthNoteInKey(rootNote, pickedN);
        MIDI.noteOn(0, note, 127, 0);
        await sleep(hold);
        MIDI.noteOff(0, note, 0);
        playable = true;
    }
</script>

<svelte:window bind:innerWidth />

<label>
    Root Note
    <input
        type="number"
        bind:value={rootNote}
        min={minRootNote}
        max={maxRootRote}
    />
    <input
        type="range"
        bind:value={rootNote}
        min={minRootNote}
        max={maxRootRote}
    />
</label>

<label>
    Random Root
    <input type="checkbox" bind:checked={randomRoot} />
</label>

<label>
    Single Note Mode
    <input type="checkbox" bind:checked={singleNoteMode} />
</label>

{#key rootNote}
    <div class="keyboard">
        <div>
            {#each notes as note}
                <Key
                    noteNum={note}
                    {keyWidth}
                    on:notepressed={({ detail }) => noteOn(detail)}
                    on:notereleased={({ detail }) => noteOff(detail)}
                    pressed={keysPressed.includes(note)}
                    bind:this={keyBindings[midiToKey(note)]}
                    numberInKey={noteToPositionInKey(rootNote, note, singleNoteMode)}
                />
            {/each}
        </div>
    </div>
{/key}

{#if !positionInKey && playable}
    <button
        on:mousedown={async () => {
            await playPattern(true);
        }}
    >
        Guess Note
    </button>
{/if}

{#if positionInKey}
    <button
        on:mousedown={async () => {
            await playPattern(false);
        }}
    >
        Replay
    </button>
{/if}

{#if verbose}
    {#each logs as log}
        <div>{log}</div>
    {/each}
{/if}
