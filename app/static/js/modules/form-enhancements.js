/* =======================================================
 * Time Travel - Form & Input Enhancements
 * Real-time validation, better feedback, improved UX
 * ======================================================= */

class FormEnhancer {
  constructor() {
    this.enhancedForms = new Map();
  }

  /**
   * Enhance a form with validation and better UX
   */
  enhanceForm(formSelector, config = {}) {
    const form = document.querySelector(formSelector);
    if (!form) return;

    const defaults = {
      validateOnChange: true,
      validateOnBlur: true,
      showLoadingState: true,
      showSuccessMessage: true,
      ...config,
    };

    // Find all input fields
    const fields = form.querySelectorAll("input, select, textarea");

    fields.forEach((field) => {
      if (defaults.validateOnChange) {
        field.addEventListener("input", (e) => {
          this.validateField(e.target);
        });
      }

      if (defaults.validateOnBlur) {
        field.addEventListener("blur", (e) => {
          this.validateField(e.target);
        });
      }

      // Add focus styles
      field.addEventListener("focus", (e) => {
        const group = e.target.closest(".form-group");
        if (group) group.classList.add("focused");
      });

      field.addEventListener("blur", (e) => {
        const group = e.target.closest(".form-group");
        if (group) group.classList.remove("focused");
      });
    });

    // Enhance submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn && defaults.showLoadingState) {
      form.addEventListener("submit", async (e) => {
        submitBtn.classList.add("loading");
        submitBtn.disabled = true;
      });
    }

    this.enhancedForms.set(formSelector, { form, config: defaults });
  }

  /**
   * Validate a single field based on its type and attributes
   */
  validateField(field) {
    const value = field.value.trim();
    const type = field.type;
    const required = field.hasAttribute("required");
    const minLength = field.getAttribute("minlength");
    const maxLength = field.getAttribute("maxlength");
    const pattern = field.getAttribute("pattern");

    let isValid = true;
    let errorMessage = "";

    // Required validation
    if (required && !value) {
      isValid = false;
      errorMessage = `${this.getFieldLabel(field)} is required`;
    }
    // Email validation
    else if (type === "email" && value) {
      isValid = FormValidator.isEmail(value);
      if (!isValid) errorMessage = "Please enter a valid email address";
    }
    // Min length validation
    else if (minLength && value && value.length < parseInt(minLength)) {
      isValid = false;
      errorMessage = `Minimum ${minLength} characters required`;
    }
    // Max length validation
    else if (maxLength && value.length > parseInt(maxLength)) {
      isValid = false;
      errorMessage = `Maximum ${maxLength} characters allowed`;
    }
    // Pattern validation
    else if (pattern && value) {
      const regex = new RegExp(`^${pattern}$`);
      isValid = regex.test(value);
      if (!isValid)
        errorMessage = `Invalid format for ${this.getFieldLabel(field)}`;
    }
    // Number validation
    else if (type === "number" && value) {
      isValid = FormValidator.isNumber(value);
      if (!isValid) errorMessage = "Please enter a valid number";
    }

    // Update field state
    if (isValid) {
      field.classList.remove("error");
      field.classList.add("success");
      this.setFieldSuccess(field, "");
    } else if (value) {
      field.classList.remove("success");
      field.classList.add("error");
      this.setFieldError(field, errorMessage);
    } else {
      field.classList.remove("success", "error");
      this.clearFieldError(field);
    }

    return isValid;
  }

  /**
   * Get label for field
   */
  getFieldLabel(field) {
    const labelEl = field.closest(".form-group")?.querySelector("label");
    if (labelEl) return labelEl.textContent.replace(/[*:]/g, "").trim();
    return field.name || field.id || "Field";
  }

  /**
   * Set field error state
   */
  setFieldError(field, message) {
    let errorEl = field.parentNode.querySelector(".form-error");
    if (!errorEl) {
      errorEl = document.createElement("span");
      errorEl.className = "form-error";
      field.parentNode.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  /**
   * Set field success state
   */
  setFieldSuccess(field, message) {
    let successEl = field.parentNode.querySelector(".form-success");
    if (!successEl) {
      successEl = document.createElement("span");
      successEl.className = "form-success";
      field.parentNode.appendChild(successEl);
    }
    successEl.textContent = message;
  }

  /**
   * Clear field error
   */
  clearFieldError(field) {
    const errorEl = field.parentNode.querySelector(".form-error");
    if (errorEl) errorEl.textContent = "";
  }

  /**
   * Validate entire form
   */
  validateForm(formSelector) {
    const entry = this.enhancedForms.get(formSelector);
    if (!entry) return true;

    const { form } = entry;
    const fields = form.querySelectorAll("input, select, textarea");
    let isValid = true;

    fields.forEach((field) => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  }

  /**
   * Reset form to initial state
   */
  resetForm(formSelector) {
    const entry = this.enhancedForms.get(formSelector);
    if (!entry) return;

    const { form } = entry;
    form.reset();

    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.classList.remove("error", "success");
      this.clearFieldError(field);
    });
  }

  /**
   * Get form data as object
   */
  getFormData(formSelector) {
    const entry = this.enhancedForms.get(formSelector);
    if (!entry) return {};

    const { form } = entry;
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      if (data[key]) {
        // Handle multiple values with same name
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });

    return data;
  }
}

// Initialize global form enhancer
const formEnhancer = new FormEnhancer();

/**
 * Auto-enhance all forms with data-enhance-form attribute
 */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-enhance-form]").forEach((form) => {
    const selector = form.tagName === "FORM" ? `#${form.id}` : form;
    formEnhancer.enhanceForm(selector);
  });
});

/**
 * Character counter helper
 */
class CharacterCounter {
  static attach(inputSelector, maxLength) {
    const input = document.querySelector(inputSelector);
    if (!input) return;

    const counter = document.createElement("div");
    counter.className = "character-counter";
    counter.textContent = `0 / ${maxLength}`;

    input.parentNode.appendChild(counter);

    const updateCounter = () => {
      counter.textContent = `${input.value.length} / ${maxLength}`;

      if (input.value.length >= maxLength * 0.9) {
        counter.classList.add("warning");
      } else {
        counter.classList.remove("warning");
      }
    };

    input.addEventListener("input", updateCounter);
  }
}

/**
 * Tag input helper
 */
class TagInput {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.tags = [];
    this.input = null;
    this.options = {
      maxTags: 5,
      delimiter: ",",
      ...options,
    };

    this.init();
  }

  init() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="tag-input-wrapper">
        <div class="tags-display"></div>
        <input type="text" class="tag-input" placeholder="Add tags (press Enter)">
      </div>
    `;

    this.input = this.container.querySelector(".tag-input");

    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === this.options.delimiter) {
        e.preventDefault();
        this.addTag(this.input.value.trim());
      }
    });

    this.input.addEventListener("blur", () => {
      if (this.input.value.trim()) {
        this.addTag(this.input.value.trim());
      }
    });
  }

  addTag(text) {
    if (!text || this.tags.includes(text)) return;
    if (this.tags.length >= this.options.maxTags) {
      showToast(`Maximum ${this.options.maxTags} tags allowed`, "warning");
      return;
    }

    this.tags.push(text);
    this.input.value = "";
    this.render();
  }

  removeTag(text) {
    this.tags = this.tags.filter((t) => t !== text);
    this.render();
  }

  render() {
    const display = this.container.querySelector(".tags-display");
    display.innerHTML = this.tags
      .map(
        (tag) => `
      <span class="tag-badge">
        ${escapeHtml(tag)}
        <button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</button>
      </span>
    `,
      )
      .join("");

    display.querySelectorAll(".tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.removeTag(btn.dataset.tag);
      });
    });
  }

  getTags() {
    return this.tags;
  }

  setTags(tags) {
    this.tags = tags;
    this.render();
  }
}

console.log("✓ Form & Input Enhancements loaded");
