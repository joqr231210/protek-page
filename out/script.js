const header = document.querySelector("[data-header]");
const workflowTabs = document.querySelectorAll("[data-workflow-tab]");
const workflowPanels = document.querySelectorAll("[data-workflow-panel]");
const demoForm = document.querySelector(".demo-form");
const formStatus = document.querySelector(".form-status");

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 20);
}

function activateWorkflow(id) {
  workflowTabs.forEach((tab) => {
    const active = tab.dataset.workflowTab === id;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  workflowPanels.forEach((panel) => {
    panel.hidden = panel.dataset.workflowPanel !== id;
  });
}

window.addEventListener("scroll", updateHeader, { passive: true });
workflowTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateWorkflow(tab.dataset.workflowTab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(workflowTabs);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
    tabs[next].focus();
    activateWorkflow(tabs[next].dataset.workflowTab);
  });
});

demoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formStatus.textContent = "Gracias. Un especialista de Protek preparará una demo con el contexto de tu operación.";
  demoForm.reset();
});

updateHeader();
if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
