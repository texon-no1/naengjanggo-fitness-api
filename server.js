// server.js
// 냉장고 피트니스용 간단 API 서버 (OpenAI 호출 담당)

import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI API 키는 나중에 Render 환경변수로 넣을 거예요.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 건강 목표/스타일을 한국어로 설명하기 위한 도우미
function goalToKorean(goal) {
    if (goal === "diet") return "다이어트(체지방 감량)";
    if (goal === "muscle") return "근력 증가(벌크업)";
    return "체중 유지/건강 관리";
}

function styleToKorean(style) {
    if (style === "high_protein") return "고단백 위주 식단";
    return "기본 한국식 식단";
}

// 헬스 레시피 생성 API
app.post("/api/recipes", async (req, res) => {
    const { goal, style, ingredients } = req.body || {};

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
    }

    if (!ingredients || typeof ingredients !== "string" || !ingredients.trim()) {
        return res.status(400).json({ error: "ingredients(재료)를 한 가지 이상 입력해야 합니다." });
    }

    const goalKo = goalToKorean(goal || "maintain");
    const styleKo = styleToKorean(style || "basic");

    const userPrompt = `
당신은 한국 헬스인(다이어트·근력·유지)을 위한 요리 코치입니다.

[조건]
- 헬스 목표: ${goalKo}
- 식단 스타일: ${styleKo}
- 냉장고 재료: ${ingredients}

[요청]
위 조건을 만족하는 한국 가정식 스타일의 한 끼 레시피를 3개 만들어 주세요.
각 레시피는 '집에서 만들기 쉬운 수준'으로 작성하고, 필요한 재료 목록과 구체적인 조리 순서도 함께 포함해 주세요. 헬스 관점에서 왜 좋은지에 대한 간단한 설명도 곁들여 주세요.
"steps"는 조리 순서를 3~5개 한국어 문장으로 된 배열로 반드시 포함할 것. 숫자 번호("1.", "2.")는 붙이지 말 것.

아래 JSON 배열 형식으로만 출력하세요. 백틱(\`)을 포함한 마크다운 코드블록 포맷은 절대 사용하지 말고 순수 JSON 문자열만 반환하세요.

[
  {
    "name": "레시피 이름",
    "tags": "태그1·태그2",
    "desc": "한 줄 설명",
    "ingredients": ["재료1", "재료2", "재료3"],
    "steps": ["고기를 한 입 크기로 썬다", "팬에 기름을 두르고 중불로 가열한다", "재료를 넣고 3분간 볶는다"],
    "youtube_query": "레시피 이름 만들기"
  }
]
  `.trim();

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful assistant for Korean fitness recipes." },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("OpenAI error:", text);
            return res.status(500).json({ error: "OpenAI API 호출 실패", detail: text });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "[]";

        let recipes = [];
        try {
            recipes = JSON.parse(content);
            if (!Array.isArray(recipes)) {
                recipes = [];
            }
        } catch (e) {
            console.error("JSON 파싱 실패:", e, content);
            recipes = [];
        }

        res.json({ recipes });
    } catch (err) {
        console.error("서버 에러:", err);
        res.status(500).json({ error: "서버 내부 오류" });
    }
});

// 1주일 식단 생성 API
app.post("/api/weekly-plan", async (req, res) => {
    const { goal, style, ingredients } = req.body || {};

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
    }

    const goalKo = goalToKorean(goal || "diet");
    const styleKo = styleToKorean(style || "basic");

    const userPrompt = `
당신은 한국 헬스인(다이어트·근력·유지)을 위한 영양사입니다.

[조건]
- 목표: ${goalKo} (특히 diet인 경우 저칼로리, 고단백, 포만감 위주 구성)
- 식단 스타일: ${styleKo}
- 가용 재료: ${ingredients}

[요청]
가용 재료를 최대한 활용하여 월요일부터 일요일까지 7일치 식단표를 만들어 주세요. 
반드시 아침, 점심, 저녁 3끼를 모두 포함해야 합니다.

각 끼니는 "요리명 + 간단한 재료 1~2가지" 형태로 작성하세요. (예: "닭가슴살 샐러드 + 방울토마토")

아래 JSON 객체 형식으로만 응답하세요. 다른 설명은 절대 하지 마세요.

{
  "plan": [
    {
      "day": "월요일",
      "breakfast": "...",
      "lunch": "...",
      "dinner": "..."
    },
    ... (일요일까지 총 7개)
  ]
}
  `.trim();

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a professional nutritionist for Korean fitness enthusiasts." },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(500).json({ error: "OpenAI API 호출 실패", detail: text });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "{}";

        let planData = { plan: [] };
        try {
            planData = JSON.parse(content);
        } catch (e) {
            console.error("JSON 파싱 실패:", e, content);
        }

        res.json(planData);
    } catch (err) {
        console.error("서버 에러:", err);
        res.status(500).json({ error: "서버 내부 오류" });
    }
});

// 간단한 헬스 체크용 엔드포인트
app.get("/", (req, res) => {
    res.send("냉장고 피트니스 API 서버 작동 중입니다.");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
