---
title: Guidelines
---

## Structure

````
```d2
ClimbingSystem: {
    shape: class
    ...
}
```

## Overview
...
## Components

## Usage

## Integration

## Configuration
````

-   Use the above code snippet as a template for the docs (don't include the quad backticks `)
-   Always start with a d2 class diagram for docs. A class diagram must be of `shape: class`
-   Include all the sections in the code snippet above.
-   Add additional sections as necessary.

## D2

-   Do not use custom styles or shapes for d2 docs.
-   The components in the diagram should reference the actual file/class names or sections of the article when possible (i.e. don't use different naming or reword them).
-   Do not include other diagrams unless specified in the content section.

## Content

-   Do not include content that is not relevant to the doc title.
-   Give concise explanations.
-   Write content from the perspective of a new dev who has to use the docs to add new features.
-   Do not include detailed internal logic.
-   Do not specify the exact constants in the explanations - reference the configuration section instead.
    -   The Configuration is an exception to this. Include the current defaults.
-   Make sure to have an Integration section that shows all of the external components and how they are related to the internal components.
    -   Use a d2 diagram to explain the relationships visually instead of using text. The d2 diagram should follow all the rules in the d2 section.
    -   The integration section should not be a class diagram.

## Conventions

-   Prefer shorter names (e.g. debug.md vs debug-system.md)
-   Use "-" in naming files over "\_"
