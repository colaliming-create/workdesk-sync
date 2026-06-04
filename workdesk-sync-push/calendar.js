(function () {
  const lunarDayNames = ["", "\u521d\u4e00", "\u521d\u4e8c", "\u521d\u4e09", "\u521d\u56db", "\u521d\u4e94", "\u521d\u516d", "\u521d\u4e03", "\u521d\u516b", "\u521d\u4e5d", "\u521d\u5341", "\u5341\u4e00", "\u5341\u4e8c", "\u5341\u4e09", "\u5341\u56db", "\u5341\u4e94", "\u5341\u516d", "\u5341\u4e03", "\u5341\u516b", "\u5341\u4e5d", "\u4e8c\u5341", "\u5eff\u4e00", "\u5eff\u4e8c", "\u5eff\u4e09", "\u5eff\u56db", "\u5eff\u4e94", "\u5eff\u516d", "\u5eff\u4e03", "\u5eff\u516b", "\u5eff\u4e5d", "\u4e09\u5341"];
  const lunarMonthNames = ["", "\u6b63\u6708", "\u4e8c\u6708", "\u4e09\u6708", "\u56db\u6708", "\u4e94\u6708", "\u516d\u6708", "\u4e03\u6708", "\u516b\u6708", "\u4e5d\u6708", "\u5341\u6708", "\u51ac\u6708", "\u814a\u6708"];
  const solarTerms = {"01-05":"\u5c0f\u5bd2","01-20":"\u5927\u5bd2","02-04":"\u7acb\u6625","02-19":"\u96e8\u6c34","03-06":"\u60ca\u86f0","03-21":"\u6625\u5206","04-05":"\u6e05\u660e","04-20":"\u8c37\u96e8","05-06":"\u7acb\u590f","05-21":"\u5c0f\u6ee1","06-06":"\u8292\u79cd","06-21":"\u590f\u81f3","07-07":"\u5c0f\u6691","07-23":"\u5927\u6691","08-08":"\u7acb\u79cb","08-23":"\u5904\u6691","09-08":"\u767d\u9732","09-23":"\u79cb\u5206","10-08":"\u5bd2\u9732","10-23":"\u971c\u964d","11-07":"\u7acb\u51ac","11-22":"\u5c0f\u96ea","12-07":"\u5927\u96ea","12-22":"\u51ac\u81f3"};
  const solarFestivals = {"01-01":"\u5143\u65e6","05-01":"\u52b3\u52a8\u8282","06-01":"\u513f\u7ae5\u8282","10-01":"\u56fd\u5e86\u8282"};
  const lunarFestivals = {"1-1":"\u6625\u8282","1-15":"\u5143\u5bb5","5-5":"\u7aef\u5348","7-7":"\u4e03\u5915","8-15":"\u4e2d\u79cb","9-9":"\u91cd\u9633","12-8":"\u814a\u516b"};
  let picker, activeInput, visibleDate = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  const dateValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function parseValue(value) {
    const match = String(value || "").match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
  }
  function lunarInfo(date) {
    try {
      const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "numeric", day: "numeric" }).formatToParts(date);
      const month = Number((parts.find((p) => p.type === "month") || {}).value);
      const day = Number((parts.find((p) => p.type === "day") || {}).value);
      return { month, day, label: day === 1 ? lunarMonthNames[month] : lunarDayNames[day] };
    } catch { return { month: 0, day: 0, label: "" }; }
  }
  function specialLabel(date) {
    const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const lunar = lunarInfo(date);
    return solarFestivals[key] || solarTerms[key] || lunarFestivals[`${lunar.month}-${lunar.day}`] || lunar.label;
  }
  function ensurePicker() {
    if (picker) return picker;
    picker = document.createElement("div");
    picker.className = "lunar-picker";
    picker.innerHTML = `<div class="lunar-picker-head"><button type="button" data-cal-prev>&uarr;</button><strong data-cal-title></strong><button type="button" data-cal-next>&darr;</button></div><div class="lunar-picker-week"><span>\u4e00</span><span>\u4e8c</span><span>\u4e09</span><span>\u56db</span><span>\u4e94</span><span>\u516d</span><span>\u65e5</span></div><div class="lunar-picker-grid" data-cal-grid></div><div class="lunar-picker-actions"><button type="button" data-cal-clear>\u6e05\u7a7a</button><button type="button" data-cal-today>\u4eca\u5929</button></div>`;
    document.body.appendChild(picker);
    picker.querySelector("[data-cal-prev]").addEventListener("click", () => { visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1); render(); });
    picker.querySelector("[data-cal-next]").addEventListener("click", () => { visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1); render(); });
    picker.querySelector("[data-cal-clear]").addEventListener("click", () => { if (activeInput) { activeInput.value = ""; activeInput.dispatchEvent(new Event("change", { bubbles: true })); } hide(); });
    picker.querySelector("[data-cal-today]").addEventListener("click", () => selectDate(new Date()));
    document.addEventListener("click", (event) => { if (!picker.contains(event.target) && event.target !== activeInput) hide(); });
  }
  function render() {
    ensurePicker();
    picker.querySelector("[data-cal-title]").textContent = `${visibleDate.getFullYear()}\u5e74${pad(visibleDate.getMonth() + 1)}\u6708`;
    const grid = picker.querySelector("[data-cal-grid]");
    grid.innerHTML = "";
    const first = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1);
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const selected = activeInput ? dateValue(parseValue(activeInput.value)) : "";
    const today = dateValue(new Date());
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const value = dateValue(date);
      const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lunar-day";
      if (date.getMonth() !== visibleDate.getMonth()) button.classList.add("outside");
      if (value === selected) button.classList.add("selected");
      if (value === today) button.classList.add("today");
      if (solarFestivals[key] || solarTerms[key]) button.classList.add("festival");
      button.innerHTML = `<span>${date.getDate()}</span><small>${specialLabel(date)}</small>`;
      button.addEventListener("click", () => selectDate(date));
      grid.appendChild(button);
    }
  }
  function positionPicker() {
    const rect = activeInput.getBoundingClientRect();
    const inDialog = Boolean(activeInput.closest("dialog"));
    picker.classList.toggle("in-dialog", inDialog);
    if (inDialog && window.innerWidth < 720) {
      picker.style.position = "fixed";
      picker.style.left = "50%";
      picker.style.top = "50%";
      picker.style.transform = "translate(-50%, -50%)";
      return;
    }
    picker.style.position = "absolute";
    picker.style.transform = "";
    const pickerHeight = Math.min(454, window.innerHeight - 16);
    const below = rect.bottom + 8;
    const above = rect.top - pickerHeight - 8;
    const top = below + pickerHeight > window.innerHeight && above > 8 ? above : below;
    picker.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 332)) + window.scrollX}px`;
    picker.style.top = `${top + window.scrollY}px`;
  }
  function selectDate(date) {
    if (!activeInput) return;
    activeInput.value = dateValue(date);
    activeInput.dispatchEvent(new Event("change", { bubbles: true }));
    activeInput.dispatchEvent(new Event("input", { bubbles: true }));
    hide();
  }
  function show(input) {
    activeInput = input;
    visibleDate = parseValue(input.value);
    ensurePicker(); render(); positionPicker(); picker.classList.add("show");
  }
  function hide() { if (picker) picker.classList.remove("show"); }
  window.enableLunarDatePickers = function () {
    document.querySelectorAll('input[type="date"], input[data-lunar-date]').forEach((input) => {
      input.type = "text"; input.readOnly = true; input.dataset.lunarDate = "true"; input.placeholder = "yyyy-mm-dd";
      input.addEventListener("click", () => show(input));
      input.addEventListener("focus", () => show(input));
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.enableLunarDatePickers); else window.enableLunarDatePickers();
})();
