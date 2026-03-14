import {
  applyAction,
  createInitialGameState,
  EVALUATION_DIMENSIONS,
  getAllowedActions,
  JUDGE_PROFILES,
  ROUND_STATES
} from "/packages/game-engine/src/index.js";
import { createJudgeBundleForRound, resolveAiTransport } from "/apps/web/src/judge-bundle-client.js";

const pitchForm = document.querySelector("#pitch-form");
const answerForm = document.querySelector("#answer-form");
const pitchInput = document.querySelector("#pitch-input");
const answerInput = document.querySelector("#answer-input");
const stateBadge = document.querySelector("#state-badge");
const judgesRoot = document.querySelector("#judges");
const transcriptRoot = document.querySelector("#transcript");
const summaryRoot = document.querySelector("#summary");
const actionPanel = document.querySelector("#action-panel");
const errorMessage = document.querySelector("#error-message");
const aiTransport = resolveAiTransport();

let state = createInitialGameState();

function setError(message) {
  if (!message) {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
    return;
  }

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function formatLabel(value) {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function renderSummary() {
  const evaluationMarkup = state.evaluation
    ? EVALUATION_DIMENSIONS.map((dimension) => {
        const score = state.evaluation[dimension];
        return `
          <div class="metric">
            <div class="metric-row">
              <span>${formatLabel(dimension)}</span>
              <strong>${score}</strong>
            </div>
            <div class="meter">
              <span style="width:${score}%"></span>
            </div>
          </div>
        `;
      }).join("")
    : "<p class=\"muted\">Submit a pitch to see the deterministic rubric.</p>";

  const questionMarkup = state.leadQuestion
    ? `
        <div class="question-card">
          <p class="eyebrow">Lead question</p>
          <p>${state.leadQuestion}</p>
        </div>
      `
    : "";

  const offerMarkup = state.offers.length
    ? `
        <div class="offer-summary">
          <p class="eyebrow">Offers on the table</p>
          ${state.offers
            .map(
              (offer) => `
                <div class="offer-chip">
                  <strong>${offer.judgeName}</strong>
                  <span>$${offer.amount.toLocaleString()} for ${offer.equity}%</span>
                </div>
              `
            )
            .join("")}
        </div>
      `
    : "";

  const resultMarkup = state.roundResult
    ? `
        <div class="result-card">
          <p class="eyebrow">Round result</p>
          <h3>${state.roundResult.headline}</h3>
          <p>${state.roundResult.summary}</p>
          <p class="muted">${state.roundResult.explanation}</p>
        </div>
      `
    : "";

  summaryRoot.innerHTML = `
    <div class="stack">
      <div>
        <p class="eyebrow">Deterministic rubric</p>
        ${evaluationMarkup}
      </div>
      ${questionMarkup}
      ${offerMarkup}
      ${resultMarkup}
    </div>
  `;
}

function renderJudges() {
  judgesRoot.innerHTML = JUDGE_PROFILES.map((judge) => {
    const response = state.judgeResponses.find((item) => item.judgeId === judge.id);
    const offer = state.offers.find((item) => item.judgeId === judge.id);

    return `
      <article class="judge-card">
        <div class="judge-card-header">
          <div>
            <p class="eyebrow">${judge.title}</p>
            <h3>${judge.name}</h3>
          </div>
          <span class="sentiment ${response?.sentiment || "muted"}">
            ${response ? formatLabel(response.sentiment) : "Waiting"}
          </span>
        </div>
        <p class="judge-bio">${judge.focus}</p>
        ${
          response
            ? `
              <p class="quote">${response.shortReaction}</p>
              <p class="muted">Tags: ${response.rationaleTags.join(", ")}</p>
            `
            : "<p class=\"muted\">No reaction yet.</p>"
        }
        ${offer ? `<p class="offer-line">$${offer.amount.toLocaleString()} for ${offer.equity}%</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderTranscript() {
  if (!state.transcript.length) {
    transcriptRoot.innerHTML = "<p class=\"muted\">The transcript will build as the round advances.</p>";
    return;
  }

  transcriptRoot.innerHTML = state.transcript
    .map(
      (entry) => `
        <div class="transcript-entry">
          <p class="transcript-speaker">${entry.speaker}</p>
          <p>${entry.text}</p>
        </div>
      `
    )
    .join("");
}

function moveToNextState(payload = {}) {
  state = applyAction(state, {
    type: "advance_when_timer_expires",
    payload
  });
}

function renderActions() {
  const allowedActions = getAllowedActions(state);
  actionPanel.innerHTML = "";
  actionPanel.classList.toggle("hidden", !allowedActions.length);

  if (state.currentState === ROUND_STATES.PITCH_SUBMITTED) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = "Hear from the judges";
    button.addEventListener("click", async () => {
      button.disabled = true;
      setError("");

      try {
        const judgeBundle = await createJudgeBundleForRound({
          state,
          judges: JUDGE_PROFILES,
          transport: aiTransport
        });
        moveToNextState(judgeBundle);
        render();
      } catch (error) {
        setError(error.message);
        button.disabled = false;
      }
    });
    actionPanel.append(button);
  }

  if (state.currentState === ROUND_STATES.JUDGE_REACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = "Answer the follow-up";
    button.addEventListener("click", () => {
      moveToNextState();
      render();
    });
    actionPanel.append(button);
  }

  if (state.currentState === ROUND_STATES.DEALS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = "Review offers";
    button.addEventListener("click", () => {
      moveToNextState();
      render();
    });
    actionPanel.append(button);
  }

  if (state.currentState === ROUND_STATES.PLAYER_DECISION) {
    if (!state.offers.length) {
      const finishButton = document.createElement("button");
      finishButton.type = "button";
      finishButton.className = "button secondary";
      finishButton.textContent = "Finish round";
      finishButton.addEventListener("click", () => {
        moveToNextState();
        render();
      });
      actionPanel.append(finishButton);
      return;
    }

    state.offers.forEach((offer) => {
      const acceptButton = document.createElement("button");
      acceptButton.type = "button";
      acceptButton.className = "button primary";
      acceptButton.textContent = `Take ${offer.judgeName}'s deal`;
      acceptButton.addEventListener("click", () => {
        state = applyAction(state, {
          type: "accept_deal",
          payload: { dealId: offer.id }
        });
        render();
      });
      actionPanel.append(acceptButton);
    });

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "button ghost";
    rejectButton.textContent = "Reject all deals";
    rejectButton.addEventListener("click", () => {
      state = applyAction(state, { type: "reject_deal" });
      render();
    });
    actionPanel.append(rejectButton);
  }

  if (state.currentState === ROUND_STATES.ROUND_RESULT) {
    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.className = "button secondary";
    restartButton.textContent = "Start another round";
    restartButton.addEventListener("click", () => {
      pitchForm.reset();
      answerForm.reset();
      state = createInitialGameState();
      render();
    });
    actionPanel.append(restartButton);
  }
}

function renderForms() {
  pitchForm.classList.toggle("hidden", state.currentState !== ROUND_STATES.LOBBY);
  answerForm.classList.toggle("hidden", state.currentState !== ROUND_STATES.FOLLOW_UP);
}

function render() {
  setError("");
  stateBadge.textContent = formatLabel(state.currentState);
  renderForms();
  renderSummary();
  renderJudges();
  renderTranscript();
  renderActions();
}

pitchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    state = applyAction(state, {
      type: "submit_pitch",
      payload: { pitch: pitchInput.value.trim() }
    });
    render();
  } catch (error) {
    setError(error.message);
  }
});

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    state = applyAction(state, {
      type: "submit_answer",
      payload: { answer: answerInput.value.trim() }
    });
    answerForm.reset();
    render();
  } catch (error) {
    setError(error.message);
  }
});

render();
