# shadow-tailwind

A Vite plugin to use computed Tailwind styles of files in your code.
Built to use within lit shadow DOM.

## Example

```typescript
import TAILWIND_CSS from "shadow-tailwind:css";

export class Component extends LitElement {
  static styles = unsafeCSS(TAILWIND_CSS);
}
````
