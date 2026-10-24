-- Цикл дня и ночи. Текущий день, фаза и время её окончания лежат в атрибутах ReplicatedStorage,
-- чтобы интерфейс клиента мог их показывать.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage.Shared.Config)

local DayNight = {}

local nightCallbacks = {}
local dayCallbacks = {}

function DayNight.onNight(callback)
	table.insert(nightCallbacks, callback)
end

function DayNight.onDay(callback)
	table.insert(dayCallbacks, callback)
end

local function fire(callbacks, day)
	for _, callback in callbacks do
		task.spawn(callback, day)
	end
end

local function setFog(isNight)
	local tweenInfo = TweenInfo.new(8)
	local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
	if atmosphere then
		TweenService:Create(atmosphere, tweenInfo, { Density = isNight and 0.55 or 0.3 }):Play()
	else
		Lighting.FogColor = Color3.fromRGB(20, 24, 35)
		TweenService:Create(Lighting, tweenInfo, { FogEnd = isNight and 180 or 1500 }):Play()
	end
end

local function setPhase(day, isNight, duration)
	ReplicatedStorage:SetAttribute("Day", day)
	ReplicatedStorage:SetAttribute("IsNight", isNight)
	ReplicatedStorage:SetAttribute("PhaseEndsAt", Workspace:GetServerTimeNow() + duration)
	setFog(isNight)
end

-- Плавно двигает солнце на 12 часов: день 6:00 → 18:00, ночь 18:00 → 6:00.
local function runClock(startClock, duration)
	local startedAt = os.clock()
	while true do
		local progress = math.min((os.clock() - startedAt) / duration, 1)
		Lighting.ClockTime = (startClock + 12 * progress) % 24
		if progress >= 1 then
			return
		end
		task.wait(0.1)
	end
end

function DayNight.start()
	task.spawn(function()
		local day = 1
		while true do
			setPhase(day, false, Config.DayDuration)
			if day > 1 then
				fire(dayCallbacks, day)
			end
			runClock(6, Config.DayDuration)

			setPhase(day, true, Config.NightDuration)
			fire(nightCallbacks, day)
			runClock(18, Config.NightDuration)

			day += 1
		end
	end)
end

return DayNight
