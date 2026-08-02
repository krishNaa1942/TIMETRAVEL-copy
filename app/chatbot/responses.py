"""
Response Templates
===================
Maps intent tags to human-friendly response strings.
Uses a list per intent so the engine can randomly pick one for variety.
"""

from typing import Dict, List

RESPONSES: Dict[str, List[str]] = {
    "greeting": [
        "Hello! Welcome to Time Travel 🌍 – your AI travel assistant. How can I help you plan your trip?",
        "Namaste! I'm Time Travel, here to help your family travel smart and safe. What would you like to know?",
        "Hey there! Ready to plan an amazing trip? Ask me about budgets, safety, weather, or packing!",
    ],
    "goodbye": [
        "Safe travels! Come back anytime you need trip advice. 👋",
        "Goodbye! Wishing you a wonderful journey ahead.",
        "See you later! Happy and safe travels to you and your family!",
    ],
    "budget": [
        "I can help estimate your trip budget! Please provide:\n"
        "• Destination\n• Number of days\n• Family size\n• Travel class (economy / comfort / premium)\n\n"
        "Or use the /api/budget/estimate endpoint directly.",
    ],
    "safety": [
        "Safety first! Tell me the destination and I'll share its safety profile.\n"
        "I check crime rates, health infrastructure, and tourist-friendliness.\n\n"
        "Or use the /api/safety/<destination> endpoint.",
    ],
    "weather": [
        "I can fetch live weather and suggest what to pack! Just tell me the city name.\n\n"
        "Or use the /api/weather/<destination> endpoint.",
    ],
    "packing": [
        "Packing smart saves hassle! Tell me your destination and I'll suggest "
        "weather-appropriate clothing and essentials based on current conditions.",
    ],
    "destination_info": [
        "I'd love to tell you about destinations! Currently I can help with:\n"
        "• Budget estimation\n• Safety scores\n• Live weather & packing advice\n\n"
        "Which one would you like?",
    ],
    "thanks": [
        "You're welcome! Happy to help with your travel planning. 😊",
        "Glad I could help! Feel free to ask anything else.",
    ],
    "help": [
        "Here's what I can do for you:\n\n"
        "1️⃣  **Budget Estimation** – Get a cost breakdown for your family trip.\n"
        "2️⃣  **Safety Score** – Check how safe a destination is for families.\n"
        "3️⃣  **Weather & Packing** – Live weather + smart packing suggestions.\n"
        "4️⃣  **Chat** – Ask me anything about travel planning!\n\n"
        "Just type your question or use the API endpoints.",
    ],
    "fallback": [
        "I'm not sure I understood that. Could you rephrase? "
        "You can ask about trip budgets, safety, weather, or packing!",
        "Hmm, I didn't catch that. Try asking about budgets, destination safety, "
        "or what to pack for your trip.",
    ],
    "transport": [
        "I can help you get around! Tell me the destination and I'll suggest "
        "local transport options — trains, buses, flights and cabs.\n\n"
        "Or use the /api/transport/<destination> endpoint.",
        "Planning the commute? Share your destination and I'll outline the best "
        "ways to reach and travel within it.",
    ],
    "accommodation": [
        "Need a place to stay? Tell me your destination, budget and family size "
        "and I'll help match you with suitable hotels or resorts.\n\n"
        "Or use the /api/hotels/<destination> endpoint.",
        "I can help you find accommodation! Share your destination and budget "
        "to get tailored suggestions.",
    ],
    "food_dining": [
        "Food is a big part of travel! Tell me your destination and I'll point "
        "you toward local specialties and family-friendly dining options.\n\n"
        "Or use the /api/food/<destination> endpoint.",
        "Looking for good eats? Share your destination and I'll suggest local "
        "cuisines and restaurants to try.",
    ],
    "entertainment": [
        "I can help you plan activities and entertainment! Tell me your "
        "destination and the kind of experiences your family enjoys.\n\n"
        "Or use the /api/things-to-do/<destination> endpoint.",
        "Want ideas for things to do? Share your destination and travel style "
        "and I'll suggest attractions and activities.",
    ],
}

# Destination-aware variants used when the user's message names a place
# ({name} is substituted). Falls back to the generic RESPONSES otherwise.
DESTINATION_RESPONSES: Dict[str, List[str]] = {
    "destination_info": [
        "Great pick — {name}! Tell me what matters most: budget, safety, "
        "weather, or things to do, and I'll tailor the advice for you.",
    ],
    "transport": [
        "For {name}: check trains, flights and cabs. I can outline the best "
        "way to reach it — or use the /api/transport/{name} endpoint.",
        "Traveling to {name}? I'll help you compare trains, flights and road "
        "options for a smooth family trip.",
    ],
    "accommodation": [
        "Looking to stay in {name}? Share your budget and family size and "
        "I'll match you with suitable hotels or resorts — or use the "
        "/api/hotels/{name} endpoint.",
        "Staying in {name}? I can help find family-friendly places to stay "
        "once I know your budget.",
    ],
    "food_dining": [
        "In {name}, local food is a highlight! I'll point you to specialties "
        "and family-friendly dining options — or use the /api/food/{name} "
        "endpoint.",
        "Eating in {name}? Share what you're craving and I'll suggest local "
        "cuisines and restaurants to try.",
    ],
    "entertainment": [
        "In {name}, there's plenty to do! Tell me the experiences your family "
        "enjoys and I'll suggest attractions — or use the "
        "/api/things-to-do/{name} endpoint.",
        "Planning fun in {name}? Share your travel style and I'll recommend "
        "activities and sights.",
    ],
    "weather": [
        "Checking weather for {name}? I can fetch live conditions and suggest "
        "what to pack — or use the /api/weather/{name} endpoint.",
    ],
    "budget": [
        "Budgeting a trip to {name}? Tell me the number of days, family size "
        "and travel class (economy / comfort / premium) for an estimate — or "
        "use the /api/budget/estimate endpoint.",
    ],
    "safety": [
        "For {name}, I check crime rates, health infrastructure and "
        "tourist-friendliness — or use the /api/safety/{name} endpoint for "
        "the full profile.",
    ],
}
