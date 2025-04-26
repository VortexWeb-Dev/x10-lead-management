const entityTypeId = 1110;

// API Endpoints
const API_BASE_URL =
  "https://x10realestate.bitrix24.com/rest/4/fvdxksv787blpg1y";
const endpoints = {
  projects:
    `${API_BASE_URL}/crm.item.list?entityTypeId=${entityTypeId}` +
    `&select[0]=ID&select[1]=ufCrm40Project`,
  leads:
    `${API_BASE_URL}/crm.item.list?entityTypeId=${entityTypeId}` +
    `&select[0]=ID` +
    `&select[1]=assignedById` +
    `&select[2]=ufCrm40Project` +
    `&select[3]=ufCrm40Community`,
  updateLead: `${API_BASE_URL}/crm.item.update?entityTypeId=${entityTypeId}`,
};
const communityAgentMap = {
  "Al Furjan": 32,
  "Creek Harbour": 32,
  "Palm Jumeirah": 34,
  "Jumeirah Village Circle": 34,
  "Arjan": 22,
  "Dubai Hills": 16,
  "Damac Lagoons": 16,
};

// DOM Elements
const elements = {
  uploadBtn: document.getElementById("uploadBtn"),
  uploadModal: document.getElementById("uploadModal"),
  closeModal: document.getElementById("closeModal"),
  modalContent: document.getElementById("modalContent"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  projectSelect: document.getElementById("projectSelect"),
  // agentSelect: document.getElementById("agentSelect"),
  numberOfLeadsInput: document.getElementById("numberOfLeadsInput"),
  submitBtn: document.getElementById("submitBtn"),
  totalLeads: document.getElementById("totalLeads"),
  assignedLeads: document.getElementById("assignedLeads"),
  unassignedLeads: document.getElementById("unassignedLeads"),
  toastContainer: document.getElementById("toastContainer"),
  uploadForm: document.getElementById("uploadForm"),
  uploadSubmitBtn: document.getElementById("uploadSubmitBtn"),
};

// Utility Functions
const toggleModal = (show) => {
  elements.uploadModal.classList.toggle("hidden", !show);
  setTimeout(() => {
    elements.modalContent.classList.toggle("scale-95", !show);
    elements.modalContent.classList.toggle("opacity-0", !show);
    elements.modalContent.classList.toggle("scale-100", show);
    elements.modalContent.classList.toggle("opacity-100", show);
  }, 10);
};

const showToast = (message, type = "success") => {
  const toast = document.createElement("div");
  toast.className = `flex items-center gap-2 p-3 rounded-md shadow-sm text-sm font-medium transition-all duration-300 transform translate-x-full ${
    type === "success"
      ? "bg-green-50 text-green-800 border border-green-200"
      : "bg-red-50 text-red-800 border border-red-200"
  }`;
  toast.innerHTML = `
        <i class="fas ${
          type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
        }"></i>
        <span>${message}</span>
    `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.remove("translate-x-full"), 10);
  setTimeout(() => {
    toast.classList.add("translate-x-full");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const toggleLoading = (show) => {
  elements.loadingOverlay.classList.toggle("hidden", !show);
};

const animateInputs = (inputs) => {
  inputs.forEach((input) => {
    input.classList.add("scale-95", "opacity-50");
    setTimeout(() => {
      input.classList.remove("scale-95", "opacity-50");
      input.classList.add("scale-100", "opacity-100");
    }, 200);
  });
};

const fetchAllPages = async (baseUrl, key = "items") => {
  let items = [];
  let start = 0;

  while (true) {
    const url = `${baseUrl}&start=${start}`;
    const response = await fetch(url);
    const json = await response.json();

    const pageItems =
      key === "items" ? json.result?.[key] || [] : json.result || [];
    if (!pageItems.length) break;

    items = items.concat(pageItems);
    if (!json.next) break;

    start = json.next;
  }

  return items;
};

const handleError = (message, error) => {
  console.error(message, error);
  showToast(message, "error");
};

// Data Fetching and Population
const populateSelect = (select, items, valueKey, textKey, defaultText) => {
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = textKey(item);
    select.appendChild(option);
  });

  if (!items.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = defaultText;
    select.appendChild(option);
  }
};

const fetchInitialData = async () => {
  toggleLoading(true);
  try {
    // Fetch and populate projects
    const projects = await fetchAllPages(endpoints.projects, "items");
    const projectNames = new Set();
    populateSelect(
      elements.projectSelect,
      projects.filter((p) => {
        const name = p.ufCrm40Project;
        if (name && !projectNames.has(name)) {
          projectNames.add(name);
          return true;
        }
        return false;
      }),
      "ufCrm40Project",
      (p) => p.ufCrm40Project,
      "No projects found"
    );
  } catch (error) {
    handleError("Failed to load data from Bitrix24. Please try again.", error);
  } finally {
    setTimeout(() => toggleLoading(false), 300);
  }
};

const fetchLeadsForProject = async (projectId) => {
  toggleLoading(true);
  try {
    const leadUrl = `${
      endpoints.leads
    }&filter[ufCrm40Project]=${encodeURIComponent(projectId)}`;
    const leads = await fetchAllPages(leadUrl, "items");

    const stats = {
      total: leads.length,
      assigned: leads.filter((l) => l.assignedById && l.assignedById != "4")
        .length,
      unassigned: leads.filter((l) => l.assignedById == "4").length,
    };

    animateInputs([
      elements.totalLeads,
      elements.assignedLeads,
      elements.unassignedLeads,
    ]);
    elements.totalLeads.value = stats.total;
    elements.assignedLeads.value = stats.assigned;
    elements.unassignedLeads.value = stats.unassigned;

    return leads;
  } catch (error) {
    handleError("Failed to load lead data. Showing defaults.", error);
    elements.totalLeads.value = 0;
    elements.assignedLeads.value = 0;
    elements.unassignedLeads.value = 0;
    return [];
  } finally {
    setTimeout(() => toggleLoading(false), 300);
  }
};

async function assignLeads(numberOfLeads, projectId) {
  const leads = await fetchLeadsForProject(projectId);
  const unassigned = leads.filter((l) => l.assignedById == "4");

  if (unassigned.length < numberOfLeads) {
    return showToast(
      `Not enough unassigned leads. Available: ${unassigned.length}, Requested: ${numberOfLeads}`,
      "error"
    );
  }

  // take the first N, but look up each lead’s agent by its community
  const leadsToAssign = unassigned.slice(0, numberOfLeads).map((lead) => {
    const agentId = communityAgentMap[lead.ufCrm40Community];
    return { id: lead.id, agentId };
  });

  toggleLoading(true);
  elements.submitBtn.disabled = true;
  elements.submitBtn.textContent = "Assigning...";

  try {
    await Promise.all(
      leadsToAssign.map(({ id, agentId }) =>
        fetch(`${endpoints.updateLead}&id=${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { assignedById: agentId } }),
        })
          .then((r) => r.json())
          .then((json) => {
            if (json.error) throw new Error(json.error);
          })
      )
    );

    // refresh stats
    await fetchLeadsForProject(projectId);
    showToast("Leads assigned successfully!", "success");
  } catch (error) {
    handleError("Failed to assign leads. Please try again.", error);
  } finally {
    toggleLoading(false);
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Submit";
  }
}

// Event Listeners
elements.uploadBtn.addEventListener("click", () => toggleModal(true));
elements.closeModal.addEventListener("click", () => toggleModal(false));

elements.projectSelect.addEventListener("change", (e) => {
  const projectId = e.target.value;
  if (projectId) {
    fetchLeadsForProject(projectId);
  } else {
    animateInputs([
      elements.totalLeads,
      elements.assignedLeads,
      elements.unassignedLeads,
    ]);
    elements.totalLeads.value = 0;
    elements.assignedLeads.value = 0;
    elements.unassignedLeads.value = 0;
  }
});

elements.submitBtn.addEventListener("click", () => {
  const projectId = elements.projectSelect.value;
  const numberOfLeads = parseInt(elements.numberOfLeadsInput.value, 10);

  if (!projectId) {
    return showToast("Please select a project first.", "error");
  }
  if (!numberOfLeads || numberOfLeads <= 0) {
    return showToast("Please enter a valid number of leads.", "error");
  }

  assignLeads(numberOfLeads, projectId);
});

elements.uploadForm.addEventListener("submit", function (e) {
  const fileInput = document.getElementById("csvFile");

  if (!fileInput.files.length) {
    showToast("Please select a CSV file before uploading.", "error");
    e.preventDefault();
    return;
  }

  elements.uploadSubmitBtn.innerText = "Uploading...";
  elements.uploadSubmitBtn.disabled = true;
  elements.uploadSubmitBtn.classList.add("opacity-50");
});

// Initialize
fetchInitialData();
