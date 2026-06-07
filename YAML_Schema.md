# YAML Schema Design

```yaml
metadata:
  title: Sample Novel Adaptation
  author: Original Author
  generated_by: ScriptForge AI
  version: "1.0"
  style: screen drama

source:
  chapter_count: 3
  chapters:
    - id: ch_001
      title: Chapter 1
      summary: The message appears.

characters:
  - id: char_001
    name: Lin
    role: protagonist
    description: The lead character.
    motivation: Discover the truth.
    relationships:
      - target: char_002
        relation: Former partner.

locations:
  - id: loc_001
    name: Old town cafe
    type: interior
    description: Dim, quiet, and old-fashioned.

timeline:
  - order: 1
    chapter_id: ch_001
    event: Lin receives a mysterious message.
    time: night
    conflict_ids:
      - conflict_001
    impact: The investigation begins.

conflicts:
  - id: conflict_001
    title: Message source
    type: external
    description: Lin must discover who sent the message before the clue disappears.
    parties:
      - char_001
      - char_002
    stakes: The truth may be buried again.
    status: active
    source_chapters:
      - ch_001
    related_timeline:
      - 1

scenes:
  - id: scene_001
    title: Rainy night reunion
    source:
      chapters:
        - ch_001
    setting:
      location: loc_001
      time: night
      atmosphere: suspenseful
    characters:
      - char_001
      - char_002
    conflict_ids:
      - conflict_001
    purpose: Introduce the central mystery.
    beats:
      - Lin waits alone.
      - Zhou appears.
      - They clash over the message.
    script:
      - type: action
        content: Rain taps against the window.
      - type: dialogue
        character: char_002
        content: Long time no see.
      - type: dialogue
        character: char_001
        content: Why are you here?
    notes:
      adaptation_strategy: Convert inner monologue into action, pauses, and dialogue.
```

## Design Notes

`characters` is a global table so scenes and conflicts can reference stable character ids instead of repeating names and descriptions.

`locations` is a global table so scenes can reuse the same location identity and description.

`timeline` records plot events in story order. It may reference `conflict_ids` to show which conflict each event advances.

`conflicts` is a first-class extraction result. Each conflict records its parties, stakes, status, source chapters, and related timeline orders. Scenes and timeline items reference conflicts by id.

`scenes` contains the structured script draft. Each scene references source chapters, characters, locations, and conflicts, then provides purpose, beats, and script lines.

## Validation

ScriptForge validates required fields and cross references:

- `scene.setting.location` must reference an existing location.
- `scene.characters` and `dialogue.character` must reference existing characters.
- `timeline.chapter_id`, `scene.source.chapters`, and `conflict.source_chapters` must reference existing chapters.
- `timeline.conflict_ids` and `scene.conflict_ids` must reference existing conflicts.
- `conflict.parties` must reference existing characters.
- `conflict.related_timeline` must reference existing timeline order numbers.
