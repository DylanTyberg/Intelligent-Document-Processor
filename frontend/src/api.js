async function request(method, path, body) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  return data;
}

export const  api = {
  async upload(userId, fileName, fileType, fileSize, file) {
    const data = await request("POST", "/documents", {
      userId, fileName, fileType, fileSize
    });
    await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": fileType },
        body: file,
    });
    return {documentId: data.documentId, signedUrl: data.signedUrl}
  },
};