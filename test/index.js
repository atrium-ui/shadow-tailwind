import { html, LitElement, unsafeCSS } from "lit";
import TAILWIND_CSS from "shadow-tailwind:css";

export class AccordionElement extends LitElement {
  static styles = unsafeCSS(TAILWIND_CSS);

  open = false;

  render() {
    return html`
      <div class="group mb-4 block rounded-md bg-zinc-100" ?opened=${this.open}>
        <button
          class="px-4 py-4 mq3:px-6 mq3:py-8 w-full text-left cursor-pointer flex justify-between items-center gap-x-6 rounded-md hover:bg-zinc-200"
          @click=${() => {
            this.open = !this.open;
            this.requestUpdate();
          }}
        >
          <div class="max-w-4xl">
            <slot class="text-xl pointer-events-none" name="title"></slot>
          </div>
        </button>
        <div class="px-4 mq3:px-6 pb-6 mq3:pb-10" ?hidden=${!this.open}>
          <slot></slot>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("a-accordion")) {
  customElements.define("a-accordion", AccordionElement);
}
