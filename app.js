const viewTabs = document.querySelectorAll("[data-view-target]");
const views = document.querySelectorAll("[data-view]");
const offerRows = document.querySelectorAll("[data-offer]");
const detailFields = document.querySelectorAll("[data-detail]");
const toast = document.querySelector(".app-toast");
const newOfferButton = document.querySelector("[data-new-offer]");

function activateView(viewId) {
  viewTabs.forEach((tab) => {
    const isActive = tab.dataset.viewTarget === viewId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  views.forEach((view) => {
    view.hidden = view.dataset.view !== viewId;
    view.classList.toggle("is-active", view.dataset.view === viewId);
  });
}

viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateView(tab.dataset.viewTarget));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(viewTabs);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    activateView(tabs[nextIndex].dataset.viewTarget);
  });
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
