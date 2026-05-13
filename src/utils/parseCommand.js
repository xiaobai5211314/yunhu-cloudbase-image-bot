const PROMPT_REQUIRED_MESSAGE = '请发送要生成的图片描述';

function parseDrawCommand(text) {
  if (typeof text !== 'string') {
    return {
      ok: false,
      error: 'missing_prompt',
      message: PROMPT_REQUIRED_MESSAGE
    };
  }

  const trimmed = text.trim();
  const match = trimmed.match(/^(\/draw|\/画图)(?:\s+([\s\S]+))?$/);

  if (!match) {
    return {
      ok: false
    };
  }

  const prompt = (match[2] || '').trim();

  if (!prompt) {
    return {
      ok: false,
      error: 'missing_prompt',
      message: PROMPT_REQUIRED_MESSAGE
    };
  }

  return {
    ok: true,
    command: match[1],
    prompt
  };
}

function parseImagePrompt(text, mode = 'all') {
  if (typeof text !== 'string') {
    return {
      ok: false,
      error: 'missing_prompt',
      message: PROMPT_REQUIRED_MESSAGE
    };
  }

  const trimmed = text.trim();

  if (!trimmed) {
    return {
      ok: false,
      error: 'missing_prompt',
      message: PROMPT_REQUIRED_MESSAGE
    };
  }

  const command = parseDrawCommand(trimmed);

  if (command.ok) {
    return {
      ok: true,
      prompt: command.prompt,
      command: command.command,
      triggeredBy: 'prefix'
    };
  }

  if (/^(\/draw|\/画图)\s*$/.test(trimmed)) {
    return {
      ok: false,
      error: 'missing_prompt',
      message: PROMPT_REQUIRED_MESSAGE
    };
  }

  if (mode === 'prefix') {
    return {
      ok: false,
      error: 'ignored'
    };
  }

  return {
    ok: true,
    prompt: trimmed,
    triggeredBy: 'all'
  };
}

module.exports = {
  PROMPT_REQUIRED_MESSAGE,
  parseDrawCommand,
  parseImagePrompt
};
