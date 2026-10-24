-- Голод, жажда, еда, питьё и естественное восстановление здоровья.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local PlayerData = require(script.Parent.PlayerData)
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local Survival = {}

function Survival.drink(player)
	if not PlayerData.getAliveCharacter(player) then
		return
	end
	local thirst = player:GetAttribute("Thirst") or 0
	if thirst >= Config.MaxThirst then
		PlayerData.notify(player, "Ты не хочешь пить")
		return
	end
	player:SetAttribute("Thirst", math.min(Config.MaxThirst, thirst + Config.DrinkAmount))
end

function Survival.eat(player)
	if not PlayerData.getAliveCharacter(player) then
		return
	end
	if PlayerData.getItem(player, "Berry") < 1 then
		PlayerData.notify(player, "Нет ягод. Ищи ягодные кусты!", "warn")
		return
	end
	local hunger = player:GetAttribute("Hunger") or 0
	if hunger >= Config.MaxHunger then
		PlayerData.notify(player, "Ты не голоден")
		return
	end
	PlayerData.addItem(player, "Berry", -1)
	player:SetAttribute("Hunger", math.min(Config.MaxHunger, hunger + Config.BerryFood))
end

local function tick(player, warned)
	local _, humanoid = PlayerData.getAliveCharacter(player)
	if not humanoid then
		return
	end

	local hunger = math.max(0, (player:GetAttribute("Hunger") or 0) - Config.HungerDecay)
	local thirst = math.max(0, (player:GetAttribute("Thirst") or 0) - Config.ThirstDecay)
	player:SetAttribute("Hunger", hunger)
	player:SetAttribute("Thirst", thirst)

	if hunger <= 0 or thirst <= 0 then
		humanoid.Health -= Config.StarveDamage
		if not warned[player] then
			warned[player] = true
			PlayerData.notify(player, hunger <= 0 and "Ты умираешь от голода!" or "Ты умираешь от жажды!", "bad")
		end
		return
	end

	warned[player] = nil
	if hunger >= Config.RegenThreshold and thirst >= Config.RegenThreshold then
		humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + Config.NaturalRegen)
	end
end

function Survival.start()
	Remotes.Eat.OnServerEvent:Connect(Survival.eat)

	local warned = {}
	Players.PlayerRemoving:Connect(function(player)
		warned[player] = nil
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			for _, player in Players:GetPlayers() do
				tick(player, warned)
			end
		end
	end)
end

return Survival
