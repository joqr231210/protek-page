const viewControls = document.querySelectorAll("[data-view-target]");
const views = document.querySelectorAll("[data-view]");
const offerRows = document.querySelectorAll("[data-offer]");
const detailFields = document.querySelectorAll("[data-detail]");
const toast = document.querySelector(".app-toast");
const newOfferButton = document.querySelector("[data-new-offer]");

function activateView(viewId) {
  viewControls.forEach((control) => {
    const isActive = control.dataset.viewTarget === viewId;
    control.classList.toggle("is-active", isActive);
    if (isActive) control.setAttribute("aria-current", "page");
    else control.removeAttribute("aria-current");
  });

  views.forEach((view) => {
    view.hidden = view.dataset.view !== viewId;
    view.classList.toggle("is-active", view.dataset.view === viewId);
  });
}

viewControls.forEach((control) => {
  control.addEventListener("click", () => activateView(control.dataset.viewTarget));
});

offerRows.forEach((row) => {
  row.addEventListener("click", () => {
    offerRows.forEach((item) => item.classList.remove("is-selected"));
    row.classList.add("is-selected");
    detailFields.forEach((field) => {
      field.textContent = row.dataset[field.dataset.detail];
    });
  });
});

newOfferButton.addEventListener("click", () => {
  toast.textContent = "Nueva oferta: inicia con cliente, activo, alcance y margen objetivo.";
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
});

if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
