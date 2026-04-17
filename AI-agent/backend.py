from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import requests  

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("travel_plans", exist_ok=True)

HEFENG_KEY = "4f2b044c93f745f6942999f0d1372374"  
HEFENG_API_URL = "https://devapi.qweather.com/v7/weather/now"
HEFENG_CITY_URL = "https://geoapi.qweather.com/v2/city/lookup"  

CITY_MAP = {
    "北京": "101010100",
    "上海": "101020100",
    "广州": "101280101",
    "深圳": "101280601",
    "杭州": "101210101",
    "成都": "101270101",
    "重庆": "101040100",
    "武汉": "101200101",
    "天津": "101030100",
    "南京": "101190101",
    "苏州": "101190401",
    "西安": "101110101",
    "长沙": "101250101",
    "郑州": "101180101"
}

def get_city_id(city_name: str):
    """国内：查询城市ID（支持更多城市）"""
    if city_name in CITY_MAP:
        return CITY_MAP[city_name]
    try:
        params = {"location": city_name, "key": HEFENG_KEY, "range": "cn"}
        res = requests.get(HEFENG_CITY_URL, params=params, timeout=5)
        data = res.json()
        if data.get("code") == "200" and data.get("location"):
            return data["location"][0]["id"]
    except:
        pass
    return None

def search_weather(city: str):
    city_id = get_city_id(city)
    if not city_id:
        return {"text": "未知", "tempMin": "0", "tempMax": "0", "error": "城市不支持"}
    
    try:
    
        params = {"location": city_id, "key": HEFENG_KEY}
        res = requests.get(HEFENG_API_URL, params=params, timeout=5)
        res.raise_for_status()  
        data = res.json()
        
        if data.get("code") == "200":
            now = data["now"]
            temp = int(now["temp"])
            return {
                "text": now["text"], 
                "tempMin": str(temp - 3),
                "tempMax": str(temp + 3),
                "temp": now["temp"],
                "humidity": now["humidity"]
            }
        else:
            return {"text": "获取失败", "tempMin": "0", "tempMax": "0", "error": f"API错误：{data.get('code')}"}
    except requests.exceptions.RequestException as e:

        return {"text": "获取失败", "tempMin": "0", "tempMax": "0", "error": f"网络异常：{str(e)}"}

def generate_travel_plan(city, weather_data):

    if "error" in weather_data:
        return f"⚠️ {city} 天气{weather_data['text']}：{weather_data['error']}"
    
    text = weather_data["text"]
    temp_min = int(weather_data["tempMin"])
    temp_max = int(weather_data["tempMax"])
    temp_now = weather_data.get("temp", "未知")
    
    # 国内天气出行建议逻辑
    if "雨" in text or "雪" in text:
        suggest = "带雨具/防滑，注意出行安全"
    elif temp_max >= 30:
        suggest = "高温炎热，防晒补水，避免正午外出"
    elif temp_min <= 5:
        suggest = "寒冷，穿厚外套、注意保暖"
    elif 10 <= temp_max <= 25:
        suggest = "温度舒适，适合户外出行"
    else:
        suggest = "正常着装，舒适出行"
    
    plan = (
        f"【{city} 实时出行计划】\n"
        f"天气：{text}\n"
        f"实时温度：{temp_now}℃ | 范围：{temp_min}℃~{temp_max}℃\n"
        f"建议：{suggest}"
    )
    
    # 保存计划到本地
    try:
        filename = f"travel_plans/plan_{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(plan)
        plan += f"\n✅ 计划已保存：{filename}"
    except Exception as e:
        plan += f"\n⚠️ 保存失败：{str(e)}"
    return plan

def agent_run(message):
    """主逻辑：匹配城市→联网查天气→生成计划"""
    city = None
    for c in CITY_MAP.keys():
        if c in message:
            city = c
            break
    if not city:
        return "请输入国内城市（如：北京、上海、广州、天津、南京）"
    
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
