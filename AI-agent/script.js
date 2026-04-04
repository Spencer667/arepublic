const msgBox = document.getElementById("msg");
const input = document.getElementById("input");

function addMessage(role, text) {
    let div = document.createElement("div");
    div.className = "message " + role;
    div.innerText = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
}

window.onload = function () {
    addMessage("assistant", "你好！请输入城市名称");
};

async function send() {
    let text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";

    addMessage("assistant", "正在查询天气...");
    let loading = msgBox.lastChild;

    try {
        let res = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });
        let data = await res.json();
        msgBox.removeChild(loading);
        addMessage("assistant", data.reply);
    } catch (e) {
        msgBox.removeChild(loading);
        addMessage("assistant", "连接服务失败，请启动后端");
    }
}