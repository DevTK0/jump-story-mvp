---
title: Documentation
type: note
permalink: development/guidelines/docs
---

## Template Structure

````
---
title: [System Name]
---

```d2 layout="elk"
SystemName: {
    shape: class
    ...
}

## Components

## Usage

## Integration

## Configuration

```
````

## Documentation Rules

### Template Requirements

- Always start with a d2 class diagram for docs. A class diagram must be of `shape: class`
- After the d2 class diagram, always provide a pragraph overview (without a section header)
- Include all sections from the template above (## Component onwards) after the overview paragraph.
- Follow the section headers strictly including the ordering (don't rename the section headers)
- Add additional sections as necessary

### D2 Diagram Guidelines

- Do not use custom styles or shapes for d2 docs
- Components in the diagram should reference actual file/class names or sections when possible (don't use different naming or reword them)
- Always used layout="elk"
- Do not include other diagrams unless specified in the content section
- `[]` is considered a special character in d2. If you want to represent an array, make sure to encase them in "" (e.g. "string[]")
- If you have to create a component that has `.` (e.g files with extensions), encase them in "" (e.g. "config.json")

### Content Guidelines

- Do not include content that is not relevant to the doc title
- Give concise explanations
- Write content from the perspective of a new dev who has to use the docs to add new features
- Do not include detailed internal logic
- Do not specify exact constants in explanations - reference the configuration section instead
  - The Configuration section is an exception - include current defaults there
- Do not include full file paths as they might change. Prefer short ones (e.g debug/config.ts)

### Usage section

- Prefer using code examples to explain.
- Make use of diff highlighting when showing examples of adding code:
  ````
  ```ts
      console.log("hewwo"); // [!code --]
      console.log("hello"); // [!code ++]
      console.log("goodbye");
  ```
  ````

### Integration Section

- Must show all external components and how they relate to internal components
- Use a d2 diagram to explain relationships visually instead of text
- The d2 diagram should follow all D2 section rules
- The integration section should not be a class diagram

### File Naming Conventions

- Prefer shorter names (e.g. debug.md vs debug-system.md)
- Use "-" in naming files over "\_"
