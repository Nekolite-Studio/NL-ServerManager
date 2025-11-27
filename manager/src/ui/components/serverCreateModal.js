export class ServerCreateModal {
  constructor() {
    this.state = {
      selectedType: null,
      showSnapshots: false,
      selectedVersion: null,
      minecraftVersions: [],
      cachedForgePromotions: null,
      cachedFabricVersions: null,
      cachedQuiltVersions: null,
      cachedPaperVersions: null,
      cachedMohistVersions: null,
      cachedMohistBuilds: new Map(),
      lastRefreshTime: 0, // For cooldown
    };

    this.serverTypes = [
      {
        category: "Official",
        items: [
          {
            id: "vanilla",
            name: "Vanilla",
            icon: "🧊",
            desc: "Minecraft 公式サーバー",
            color: "bg-blue-500",
          },
        ],
      },
      {
        category: "Mod Loaders",
        items: [
          {
            id: "forge",
            name: "Forge",
            icon: "⚒️",
            desc: "定番の大規模Modローダー",
            color: "bg-orange-600",
          },
          {
            id: "neoforge",
            name: "NeoForge",
            icon: "🦊",
            desc: "Forgeから派生した新標準",
            color: "bg-orange-500",
          },
          {
            id: "fabric",
            name: "Fabric",
            icon: "🧵",
            desc: "軽量かつ高速なローダー",
            color: "bg-yellow-100 text-black",
          },
          {
            id: "quilt",
            name: "Quilt",
            icon: "🟣",
            desc: "Fabric互換のコミュニティ版",
            color: "bg-purple-500",
          },
        ],
      },
      {
        category: "Plugins",
        items: [
          {
            id: "paper",
            name: "Paper",
            icon: "📄",
            desc: "高速・軽量プラグインサーバー",
            color: "bg-red-500",
          },
        ],
      },
      {
        category: "Hybrid",
        items: [
          {
            id: "mohist",
            name: "Mohist",
            icon: "🧬",
            desc: "Forge Mods + Paper Plugins",
            color: "bg-indigo-500",
          },
        ],
      },
    ];

    // Default selection
    this.state.selectedType = this.serverTypes[0].items[0];

    this.els = {
      overlay: document.getElementById("modalOverlay"),
      backdrop: document.getElementById("modalBackdrop"),
      content: document.getElementById("modalContent"),

      serverNameInput: document.getElementById("serverNameInput"),
      hostSelect: document.getElementById("hostSelect"),

      typeBtn: document.getElementById("typeSelectBtn"),
      typeMenu: document.getElementById("typeDropdownMenu"),
      selectedIcon: document.getElementById("selectedTypeIcon"),
      selectedName: document.getElementById("selectedTypeName"),
      selectedDesc: document.getElementById("selectedTypeDesc"),

      snapshotToggle: document.getElementById("snapshotToggle"),
      mcVersionSelect: document.getElementById("mcVersionSelect"),
      versionCount: document.getElementById("versionCountLabel"),
      manifestUpdated: document.getElementById("manifestUpdatedText"),
      refreshManifestBtn: document.getElementById("refreshManifestBtn"),

      buildBlock: document.getElementById("buildBlock"),
      buildLabel: document.getElementById("buildLabel"),
      buildSelect: document.getElementById("buildSelect"),
      buildIcon: document.getElementById("buildIcon"),
      buildStatus: document.getElementById("buildStatusBadge"),
      buildUpdated: document.getElementById("buildUpdatedText"),
      refreshBuildBtn: document.getElementById("refreshBuildBtn"),

      javaVer: document.getElementById("javaVersionDisplay"),

      createBtn: document.getElementById("createBtn"),
      createBtnText: document.getElementById("createBtnText"),
      createSpinner: document.getElementById("createSpinner"),
      cancelBtn: document.getElementById("cancelCreateBtn"),
    };

    this.init();
  }

  init() {
    if (!this.els.overlay || !this.els.createBtn) {
        console.error("ServerCreateModal: Critical DOM elements missing.");
        return;
    }

    this.renderTypeDropdown();
    this.setupListeners();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  setupListeners() {
    this.els.cancelBtn.addEventListener("click", () => this.close());
    this.els.overlay.addEventListener("click", (e) => {
      if (
        e.target === this.els.overlay ||
        e.target === document.querySelector("#modalOverlay > div.p-4")
      ) {
        this.close();
      }
    });

    // Type Selection
    this.els.typeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleTypeDropdown();
    });

    document.addEventListener("click", (e) => {
      if (
        this.els.typeBtn &&
        this.els.typeMenu &&
        !this.els.typeBtn.contains(e.target) &&
        !this.els.typeMenu.contains(e.target)
      ) {
        this.toggleTypeDropdown(false);
      }
    });

    // Version & Build
    this.els.snapshotToggle.addEventListener("change", (e) => {
      this.state.showSnapshots = e.target.checked;
      this.updateVersionList();
    });

    this.els.mcVersionSelect.addEventListener("change", (e) => {
      this.state.selectedVersion = e.target.value;
      this.updateBuildList();
      this.updateJavaVersion();
    });

    // Refresh Buttons
    this.els.refreshManifestBtn.addEventListener("click", () => {
      this.animateButton(this.els.refreshManifestBtn);
      this.fetchInitialData(true); // Force refresh
    });

    this.els.refreshBuildBtn.addEventListener("click", () => {
      if (this.state.selectedType.id === "vanilla") return;

      const now = Date.now();
      if (now - this.state.lastRefreshTime < 15000) {
        const remaining = Math.ceil((15000 - (now - this.state.lastRefreshTime)) / 1000);
        window.showNotification(`更新は15秒に1回のみ可能です (あと${remaining}秒)`, "warning");
        return;
      }
      this.state.lastRefreshTime = now;

      this.animateButton(this.els.refreshBuildBtn);
      this.updateBuildList(true); // Force refresh
    });

    // Create
    this.els.createBtn.addEventListener("click", () => this.handleCreate());
  }

  animateButton(btnElement, duration = 1000) {
    const icon =
      btnElement.querySelector("svg") || btnElement.querySelector("i");
    if (icon && !icon.classList.contains("animate-spin")) {
      icon.classList.add("animate-spin");
      setTimeout(() => icon.classList.remove("animate-spin"), duration);
    }
  }

  async open() {
    this.els.overlay.classList.remove("hidden");
    setTimeout(() => {
      this.els.backdrop.classList.remove("opacity-0");
      this.els.content.classList.remove("opacity-0", "scale-95");
    }, 10);

    this.resetForm();
    await this.fetchInitialData();
  }

  close() {
    this.els.backdrop.classList.add("opacity-0");
    this.els.content.classList.add("opacity-0", "scale-95");

    setTimeout(() => {
      this.els.overlay.classList.add("hidden");
    }, 200);
  }

  resetForm() {
    this.els.serverNameInput.value = "";
    this.els.createBtn.disabled = false;
    this.els.createBtnText.classList.remove("hidden");
    this.els.createSpinner.classList.add("hidden");
    this.els.createSpinner.classList.remove("flex");

    this.selectType("vanilla");
  }

  async fetchInitialData(isRefresh = false) {
    if (isRefresh) {
      this.els.manifestUpdated.textContent = "Updating manifest...";
      this.els.manifestUpdated.className = "text-blue-400 font-medium";
    } else {
      window.showNotification(
        "サーバー情報を取得中...",
        "info",
        "fetching-versions",
        3000
      );
    }

    // Populate Host Select
    this.els.hostSelect.innerHTML = "";
    const onlineAgents = Array.from(
      window.state.physicalServers.values()
    ).filter((p) => p.status === "Connected");
    if (onlineAgents.length === 0) {
      this.els.hostSelect.innerHTML =
        '<option value="">利用可能なホストがありません</option>';
      this.els.hostSelect.disabled = true;
      this.els.createBtn.disabled = true;
    } else {
      onlineAgents.forEach((agent) => {
        const option = document.createElement("option");
        option.value = agent.id;
        option.textContent = `${agent.config.alias} (${agent.config.ip})`;
        this.els.hostSelect.appendChild(option);
      });
      this.els.hostSelect.disabled = false;
      this.els.createBtn.disabled = false;
    }

    // Fetch Versions
    const promises = [
      window.electronAPI.getMinecraftVersions(),
      window.electronAPI.getForgeVersions(),
      window.electronAPI.getFabricVersions(),
      window.electronAPI.getQuiltVersions(),
      window.electronAPI.getPaperVersions(),
      window.electronAPI.getMohistVersions(),
    ];

    const results = await Promise.allSettled(promises);
    const [vanilla, forge, fabric, quilt, paper, mohist] = results;

    if (vanilla.status === "fulfilled" && vanilla.value.success)
      this.state.minecraftVersions = vanilla.value.versions;
    if (forge.status === "fulfilled" && forge.value.success)
      this.state.cachedForgePromotions = forge.value.promotions;
    if (fabric.status === "fulfilled" && fabric.value.success)
      this.state.cachedFabricVersions = fabric.value.versions;
    if (quilt.status === "fulfilled" && quilt.value.success)
      this.state.cachedQuiltVersions = quilt.value.versions;
    if (paper.status === "fulfilled" && paper.value.success)
      this.state.cachedPaperVersions = paper.value.versions;
    if (mohist.status === "fulfilled" && mohist.value.success)
      this.state.cachedMohistVersions = mohist.value.versions;

    if (isRefresh) {
      const now = new Date();
      this.els.manifestUpdated.textContent = `Manifest updated: ${now.toLocaleTimeString()}`;
      this.els.manifestUpdated.className = "text-green-400 font-medium";
      setTimeout(
        () => (this.els.manifestUpdated.className = "text-gray-500"),
        2000
      );
    } else {
      window.showNotification(
        "サーバー情報の取得が完了しました",
        "success",
        "fetching-versions",
        2000
      );
      this.els.manifestUpdated.textContent = "Manifest loaded";
    }

    this.updateVersionList();
  }

  renderTypeDropdown() {
    let html = "";
    this.serverTypes.forEach((cat) => {
      html += `<div class="p-2">`;
      html += `<div class="text-xs font-bold text-gray-500 px-2 py-1 uppercase tracking-wider">${cat.category}</div>`;
      cat.items.forEach((type) => {
        html += `
                    <button type="button" data-type-id="${type.id}" class="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-700 transition-colors text-left group">
                        <div class="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-lg shadow-inner group-hover:bg-gray-600 transition-colors">
                            ${type.icon}
                        </div>
                        <div>
                            <div class="text-sm font-bold text-gray-200">${type.name}</div>
                            <div class="text-[10px] text-gray-500 group-hover:text-gray-400">${type.desc}</div>
                        </div>
                    </button>
                `;
      });
      html += `</div>`;
    });
    this.els.typeMenu.innerHTML = html;

    this.els.typeMenu
      .querySelectorAll("button[data-type-id]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          this.selectType(btn.dataset.typeId);
        });
      });
  }

  toggleTypeDropdown(forceState = null) {
    const isHidden = this.els.typeMenu.classList.contains("hidden");
    const shouldShow = forceState !== null ? forceState : isHidden;

    if (shouldShow) {
      this.els.typeMenu.classList.remove("hidden");
      this.els.typeBtn.classList.add(
        "ring-2",
        "ring-blue-500",
        "border-transparent"
      );
    } else {
      this.els.typeMenu.classList.add("hidden");
      this.els.typeBtn.classList.remove(
        "ring-2",
        "ring-blue-500",
        "border-transparent"
      );
    }
  }

  selectType(typeId) {
    let found = null;
    this.serverTypes.forEach((c) => {
      const item = c.items.find((i) => i.id === typeId);
      if (item) found = item;
    });

    if (!found) return;
    this.state.selectedType = found;

    this.els.selectedIcon.textContent = found.icon;
    this.els.selectedName.textContent = found.name;
    this.els.selectedDesc.textContent = found.desc;

    if (found.id === "vanilla") {
      this.els.buildBlock.classList.add("opacity-50", "pointer-events-none");
      this.els.buildStatus.textContent = "Managed by Mojang";
      this.els.buildStatus.className =
        "text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400";
    } else {
      this.els.buildBlock.classList.remove("opacity-50", "pointer-events-none");
      this.els.buildLabel.innerHTML = `<i data-lucide="package" class="w-3 h-3 mr-2"></i> ${found.name} Build`;
      if (window.lucide) window.lucide.createIcons();
      this.els.buildStatus.textContent = "Ready";
      this.els.buildStatus.className =
        "text-[10px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50";
    }

    this.toggleTypeDropdown(false);
    this.updateVersionList();
  }

  updateVersionList() {
    this.els.mcVersionSelect.innerHTML = "";
    let list = [];

    if (
      this.state.selectedType.id === "mohist" &&
      this.state.cachedMohistVersions
    ) {
      list = this.state.cachedMohistVersions.map((v) => v.name);
    } else if (
      this.state.selectedType.id === "paper" &&
      this.state.cachedPaperVersions
    ) {
      list = this.state.cachedPaperVersions.map((v) => v.version.id);
    } else {
      if (this.state.minecraftVersions) {
        list = this.state.minecraftVersions
          .filter((v) => this.state.showSnapshots || v.type === "release")
          .map((v) => v.id);
      }
    }

    if (list.length === 0) {
      this.els.mcVersionSelect.innerHTML = "<option>No versions found</option>";
      this.els.versionCount.textContent = "0 versions";
      return;
    }

    list.forEach((ver) => {
      const opt = document.createElement("option");
      opt.value = ver;
      opt.textContent = ver;
      this.els.mcVersionSelect.appendChild(opt);
    });

    this.els.versionCount.textContent = `${list.length} versions`;
    this.state.selectedVersion = list[0];
    this.updateBuildList();
    this.updateJavaVersion();
  }

  async updateBuildList(isRefresh = false) {
    const type = this.state.selectedType.id;
    const mcVer = this.els.mcVersionSelect.value;
    this.els.buildSelect.innerHTML = "";

    if (type === "vanilla") return;

    // Loading State
    this.els.buildSelect.disabled = true;
    this.els.buildSelect.classList.add("select-loading", "text-gray-400");
    this.els.buildSelect.innerHTML =
      "<option>Fetching builds from API...</option>";
    this.els.buildStatus.textContent = "Fetching...";
    this.els.buildStatus.className =
      "text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50 animate-pulse";

    if (isRefresh) this.els.buildUpdated.textContent = "Refreshing cache...";

    try {
      if (type === "forge") {
        this.els.buildSelect.innerHTML = "";
        const latestKey = `${mcVer}-latest`;
        const recommendedKey = `${mcVer}-recommended`;
        const promotions = this.state.cachedForgePromotions || {};

        if (promotions[recommendedKey]) {
          this.addBuildOption(
            promotions[recommendedKey],
            `${promotions[recommendedKey]} (Recommended)`
          );
        }
        if (
          promotions[latestKey] &&
          promotions[latestKey] !== promotions[recommendedKey]
        ) {
          this.addBuildOption(
            promotions[latestKey],
            `${promotions[latestKey]} (Latest)`
          );
        }
      } else if (type === "fabric" && this.state.cachedFabricVersions) {
        this.els.buildSelect.innerHTML = "";
        this.state.cachedFabricVersions.forEach((v) => {
          this.addBuildOption(
            v.version,
            v.stable ? `${v.version} (Stable)` : v.version
          );
        });
      } else if (type === "quilt" && this.state.cachedQuiltVersions) {
        this.els.buildSelect.innerHTML = "";
        this.state.cachedQuiltVersions.forEach((v) => {
          this.addBuildOption(v.version, v.version);
        });
      } else if (type === "neoforge") {
        const result = await window.electronAPI.getNeoForgeVersions(mcVer, isRefresh);
        this.els.buildSelect.innerHTML = "";
        if (result.success && result.versions.length > 0) {
          result.versions.forEach((v) => this.addBuildOption(v, v));
        }
      } else if (type === "paper") {
        const result = await window.electronAPI.getPaperBuilds(mcVer, isRefresh);
        this.els.buildSelect.innerHTML = "";
        if (result.success && result.builds.length > 0) {
          // Builds are already sorted descending (newest first) from API
          result.builds
            .forEach((b) => this.addBuildOption(b, `Build #${b}`));
        }
      } else if (type === "mohist") {
        let builds = this.state.cachedMohistBuilds.get(mcVer);
        if (!builds || isRefresh) {
          const result = await window.electronAPI.getMohistBuilds(mcVer, isRefresh);
          if (result.success) {
            builds = result.builds;
            this.state.cachedMohistBuilds.set(mcVer, builds);
          }
        }
        this.els.buildSelect.innerHTML = "";
        if (builds && builds.length > 0) {
          builds.forEach((b) =>
            this.addBuildOption(
              b.id,
              `Build #${b.id} (${b.build_date.substring(0, 10)})`
            )
          );
        }
      }

      if (this.els.buildSelect.children.length === 0) {
        this.els.buildSelect.innerHTML =
          '<option value="">No builds found</option>';
      } else {
        // Select the first option (latest) by default
        this.els.buildSelect.selectedIndex = 0;
      }

      const now = new Date();
      this.els.buildUpdated.textContent = `Cached: ${now.toLocaleTimeString()}`;
    } catch (e) {
      console.error("Failed to fetch builds:", e);
      this.els.buildSelect.innerHTML = "<option>Error fetching builds</option>";
      window.showNotification(`ビルド情報の取得に失敗しました`, "error");
    } finally {
      // Reset UI state
      this.els.buildSelect.disabled = false;
      this.els.buildSelect.classList.remove("select-loading", "text-gray-400");
      this.els.buildStatus.textContent = "Ready";
      this.els.buildStatus.className =
        "text-[10px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50";
    }
  }

  addBuildOption(value, text) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    this.els.buildSelect.appendChild(opt);
  }

  async updateJavaVersion() {
    const mcVer = this.els.mcVersionSelect.value;
    if (!mcVer || mcVer === "No versions found") {
      this.els.javaVer.textContent = "Unknown";
      return;
    }

    this.els.javaVer.textContent = "Checking...";

    try {
      const result = await window.electronAPI.getRequiredJavaVersion({
        mcVersion: mcVer,
        serverType: this.state.selectedType.id,
      });
      if (result && result.success) {
        this.els.javaVer.textContent = `Java ${result.javaVersion}`;
      } else {
        // Fallback heuristic if API returns failure/unknown
        this.applyJavaHeuristic(mcVer);
      }
    } catch (e) {
      console.warn("Java version check failed, using heuristic:", e);
      this.applyJavaHeuristic(mcVer);
    }
  }

  applyJavaHeuristic(mcVer) {
    let java = "Java 8";
    if (
      mcVer.includes("1.20") ||
      mcVer.includes("1.19") ||
      mcVer.includes("1.18")
    )
      java = "Java 17";
    else if (mcVer.includes("1.21") || mcVer.includes("24w")) java = "Java 21";
    else if (mcVer.includes("1.17") || mcVer.includes("1.16.5"))
      java = "Java 16/11";
    this.els.javaVer.textContent = `${java}`;
  }

  async handleCreate() {
    const serverName = this.els.serverNameInput.value || "New Server";
    const hostId = this.els.hostSelect.value;
    const type = this.state.selectedType.id;
    const mcVersion = this.els.mcVersionSelect.value;
    const loaderVersion = this.els.buildSelect.value;

    if (!hostId) {
      window.showNotification("ホストマシンを選択してください", "error");
      return;
    }

    // UI Loading State
    this.els.createBtn.disabled = true;
    this.els.createBtnText.classList.add("hidden");
    this.els.createSpinner.classList.remove("hidden");
    this.els.createSpinner.classList.add("flex", "items-center", "gap-2");
    this.els.cancelBtn.disabled = true;
    this.els.cancelBtn.classList.add("opacity-50", "cursor-not-allowed");

    try {
      // Send Request
      window.electronAPI.proxyToAgent(hostId, {
        type: window.electronAPI.Message.CREATE_SERVER,
        payload: {
          versionId: mcVersion,
          serverType: type,
          loaderVersion: type === "vanilla" ? null : loaderVersion,
          serverName: serverName,
          runtime: {
            min_memory: 1024,
            max_memory: 4096,
            java_path: null,
          },
        },
      });

      await new Promise((r) => setTimeout(r, 1000));

      window.showNotification(
        "サーバー作成リクエストを送信しました",
        "success"
      );
      this.close();
    } catch (error) {
      console.error(error);
      window.showNotification(
        `エラーが発生しました: ${error.message}`,
        "error"
      );
    } finally {
      // Reset UI state
      this.els.createBtn.disabled = false;
      this.els.createBtnText.classList.remove("hidden");
      this.els.createSpinner.classList.add("hidden");
      this.els.createSpinner.classList.remove("flex");
      this.els.cancelBtn.disabled = false;
      this.els.cancelBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }
}
