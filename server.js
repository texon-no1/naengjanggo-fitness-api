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

아래 JSON 배열 형식으로만 출력하세요. 백틱(\`)을 포함한 마크다운 코드블록 포맷은 절대 사용하지 말고 순수 JSON 문자열만 반환하세요.

[
  {
    "name": "요리 이름 (최대 20자)",
    "tags": "태그1 · 태그2 (예: 저칼로리·포만감)",
    "desc": "간단 설명 (최대 80자, 헬스/다이어트 관점에서 장점 위주)",
    "ingredients": [
      "닭가슴살 100g",
      "고구마 1개"
    ],
    "steps": [
      "1. 고구마를 삶습니다.",
      "2. 닭가슴살을 굽습니다."
    ],
    "youtube_query": "유튜브 검색 키워드 (예: 닭가슴살 다이어트 레시피)"
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

// 간단한 헬스 체크용 엔드포인트
app.get("/", (req, res) => {
    res.send("냉장고 피트니스 API 서버 작동 중입니다.");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
