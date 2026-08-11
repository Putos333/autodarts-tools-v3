export function waitForElement(selector: string | string[], timeout = 3000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      if (Array.isArray(selector)) {
        for (const sel of selector) {
          const element = document.querySelector(sel);
          if (element) {
            clearInterval(timer);
            // @ts-expect-error
            resolve(element);
            return;
          }
        }
      } else {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(timer);
          // @ts-expect-error
          resolve(element);
          return;
        }
      }

      // Skip timeout check if timeout is 0
      if (timeout !== 0 && Date.now() - startTime >= timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for element ${selector}`));
      }
    }, 100);
  });
}

export function waitForElementWithTextContent(selector: string | string[], textContent: string | string[], timeout = 3000): Promise<HTMLElement> {
  const texts = Array.isArray(textContent) ? textContent : [textContent];
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      if (Array.isArray(selector)) {
        for (const sel of selector) {
          const elements = document.querySelectorAll(sel);
          for (const element of elements) {
            if (texts.includes(element.textContent ?? "")) {
              clearInterval(timer);
              resolve(element as HTMLElement);
              return;
            }
          }
        }
      } else {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (texts.includes(element.textContent ?? "")) {
            clearInterval(timer);
            resolve(element as HTMLElement);
            return;
          }
        }
      }

      if (Date.now() - startTime >= timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for element ${selector} with text content ${texts.join(", ")}`));
      }
    }, 100);
  });
}

/**
 * @param css {string} - CSS rules string to be added
 * @param componentName {string} - Name of the component
 */
export function addStyles(css: string, componentName: string = "") {
  const style = document.createElement("style");
  style.id = `ad-ext_style_${componentName}`;
  style.innerHTML = css;
  if (!document.querySelector(`#${style.id}`)) {
    document.head.appendChild(style);
  }
}
