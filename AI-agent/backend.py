from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from duckduckgo_search import DDGS
from datetime import datetime
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("travel_plans", exist_ok=True)

def search_weather(city: str):
    try:
        query = f"{city} 未来1天天气"
        results = DDGS().text(query, max_results=2)
        if not results:
            return {"error": "未找到天气信息"}

        weather = {
            "city": city,
            "daily": [{
                "fxDate": datetime.now().strftime("%Y-%m-%d"),
                "text": "晴",
                "tempMin": "16",
                "tempMax": "28",
                "windDir": "东风"
            }]
        }
        body = results[0]["body"]
        if "雨" in body:
            weather["daily"][0]["text"] = "雨"
        if "雪" in body:
            weather["daily"][0]["text"] = "雪"
        if "多云" in body:
            weather["daily"][0]["text"] = "多云"
        return weather
    except:
        return {"error": "天气查询失败"}

def generate_travel_plan(city, weather_data):
    if "error" in weather_data:
        return "获取天气失败"
    
    day = weather_data["daily"][0]
    text = day["text"]
    
    if "雨" in text:
        suggest = "记得带伞"
    elif "雪" in text:
        suggest = "注意保暖防滑"
    elif int(day["tempMax"]) >= 28:
        suggest = "天气炎热，注意防晒"
    elif int(day["tempMin"]) <= 10:
        suggest = "天气较冷，穿外套"
    else:
        suggest = "天气舒适，放心出行"
    
    return f"{city}：{text}，{suggest}"

def agent_run(message):
    city_list = ["北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "武汉"]
    city = None
    for c in city_list:
        if c in message:
            city = c
            break
    if not city:
        return "请输入城市名称"
    
    weather = search_weather(city)
    return generate_travel_plan(city, weather)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    return {"reply": agent_run(req.message)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)