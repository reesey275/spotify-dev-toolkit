// Vision guard for AI requests - prevents sending images to text-only models
// Adapted from TypeScript version for JavaScript compatibility

const MODEL_CAPS = {
  "grok-code-fast-1": { vision: false },
  "grok-vision": { vision: true },
  "gpt-4o": { vision: true },
  "claude-3-7-sonnet": { vision: true },
};

const IMAGE_KEYS = ["image_url", "input_image", "images", "attachments", "file"];

function isDataImage(s) {
  return typeof s === "string" && s.startsWith("data:image/");
}

function looksLikeImagePart(p) {
  if (!p || typeof p !== "object") return false;
  if (typeof p.type === "string" && p.type.toLowerCase().includes("image")) return true;
  if (typeof p.image_url === "string") return true;
  if (isDataImage(p.url) || isDataImage(p.data)) return true;
  return false;
}

function hasVisionContent(messages) {
  return messages.some((m) => {
    if (Array.isArray(m.content) && m.content.some(looksLikeImagePart)) return true;
    if (typeof m.content === "string" && isDataImage(m.content)) return true;
    // flat styles / hidden fields
    for (const k of IMAGE_KEYS) {
      const v = m[k];
      if (isDataImage(v)) return true;
      if (k === "image_url" && typeof v === "string") return true;
      if (k !== "image_url" && v != null) return true;
    }
    return false;
  });
}

function pruneImages(messages, onPrune) {
  let prunedCount = 0;

  const cleaned = messages.map((m) => {
    const base = { ...m };

    // Remove flat image-ish fields
    for (const k of IMAGE_KEYS) {
      if (base[k] != null) {
        prunedCount++;
        delete base[k];
      }
    }

    // Remove image parts from array content
    if (Array.isArray(base.content)) {
      const before = base.content.length;
      const afterParts = base.content.filter((p) => !looksLikeImagePart(p));
      prunedCount += before - afterParts.length;
      base.content = afterParts;
    } else if (typeof base.content === "string" && isDataImage(base.content)) {
      prunedCount++;
      base.content = "";
    }

    return base;
  });

  if (prunedCount > 0 && onPrune) onPrune({ count: prunedCount });
  return cleaned;
}

function chooseModel(messages, preferred, caps = MODEL_CAPS, visionFallbackEnv) {
  const wantsVision = hasVisionContent(messages);
  const prefHasVision = !!(caps[preferred] && caps[preferred].vision);
  if (wantsVision && !prefHasVision) {
    const fallback = visionFallbackEnv && caps[visionFallbackEnv] && caps[visionFallbackEnv].vision ? visionFallbackEnv
      : Object.keys(caps).find((m) => caps[m] && caps[m].vision);
    return fallback || preferred;
  }
  return preferred;
}

module.exports = {
  MODEL_CAPS,
  hasVisionContent,
  pruneImages,
  chooseModel,
};