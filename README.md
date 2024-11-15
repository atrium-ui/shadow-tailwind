# shadow-tailwind

A Vite plugin to use computed Tailwind styles of files in your code.
Built to use within lit shadow DOM.

## Example

```typescript
import { LitElement, html, unsafeCSS } from "lit";
import TAILWIND_CSS from "shadow-tailwind:css";

export class Component extends LitElement {
  static styles = unsafeCSS(TAILWIND_CSS);

  render() {
    return html`
      <div class="text-xl bg-red-300">Tailwind</div>
    `;
  }
}
````
