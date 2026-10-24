-- Инвентарь, голод/жажда, таблица игроков и сохранение рекорда.
-- Всё состояние хранится в атрибутах игрока, поэтому клиент видит его без отдельных событий.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local PlayerData = {}

local recordStore = nil
do
	local ok, store = pcall(function()
		return DataStoreService:GetDataStore("SurvivalRecords_v1")
	end)
	if ok then
		recordStore = store
	end
end

local loadedRecords = {} -- [player] = рекорд, загруженный из DataStore

local function itemAttribute(itemId)
	return "Item_" .. itemId
end

function PlayerData.notify(player, text, kind)
	Remotes.Notify:FireClient(player, text, kind or "info")
end

function PlayerData.notifyAll(text, kind)
	Remotes.Notify:FireAllClients(text, kind or "info")
end

function PlayerData.getItem(player, itemId)
	return player:GetAttribute(itemAttribute(itemId)) or 0
end

function PlayerData.addItem(player, itemId, amount)
	player:SetAttribute(itemAttribute(itemId), PlayerData.getItem(player, itemId) + amount)
end

function PlayerData.hasItems(player, cost)
	for itemId, amount in cost do
		if PlayerData.getItem(player, itemId) < amount then
			return false
		end
	end
	return true
end

function PlayerData.removeItems(player, cost)
	for itemId, amount in cost do
		PlayerData.addItem(player, itemId, -amount)
	end
end

function PlayerData.getStat(player, statName)
	local leaderstats = player:FindFirstChild("leaderstats")
	return leaderstats and leaderstats:FindFirstChild(statName)
end

function PlayerData.getAliveCharacter(player)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if humanoid and root and humanoid.Health > 0 then
		return character, humanoid, root
	end
	return nil
end

function PlayerData.addKill(player)
	local kills = PlayerData.getStat(player, Config.Stats.Kills)
	if kills then
		kills.Value += 1
	end
end

-- Вызывается на рассвете: всем живым игрокам +1 прожитый день.
function PlayerData.rewardSurvivors()
	for _, player in Players:GetPlayers() do
		if not PlayerData.getAliveCharacter(player) then
			continue
		end
		local days = PlayerData.getStat(player, Config.Stats.Days)
		local best = PlayerData.getStat(player, Config.Stats.Best)
		if not (days and best) then
			continue
		end
		days.Value += 1
		if days.Value > best.Value then
			best.Value = days.Value
			PlayerData.notify(player, "Новый рекорд: " .. days.Value .. " дн.!", "good")
		else
			PlayerData.notify(player, "Ты пережил ночь! Дней подряд: " .. days.Value, "good")
		end
	end
end

local function resetSurvival(player)
	for _, itemId in Config.ItemOrder do
		player:SetAttribute(itemAttribute(itemId), 0)
	end
	player:SetAttribute("Hunger", Config.MaxHunger)
	player:SetAttribute("Thirst", Config.MaxThirst)
end

local function loadRecord(player, best)
	if not recordStore then
		return
	end
	local ok, value = pcall(function()
		return recordStore:GetAsync(tostring(player.UserId))
	end)
	if ok and typeof(value) == "number" then
		loadedRecords[player] = value
		best.Value = math.max(best.Value, value)
	elseif not ok then
		warn("Не удалось загрузить рекорд (в Studio включи API Services):", value)
	end
end

local function saveRecord(player)
	local best = PlayerData.getStat(player, Config.Stats.Best)
	if not (recordStore and best) or best.Value <= (loadedRecords[player] or 0) then
		return
	end
	local value = best.Value
	local ok, err = pcall(function()
		recordStore:UpdateAsync(tostring(player.UserId), function(old)
			return math.max(old or 0, value)
		end)
	end)
	if ok then
		loadedRecords[player] = value
	else
		warn("Не удалось сохранить рекорд:", err)
	end
end

local function onPlayerAdded(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	for _, statName in { Config.Stats.Days, Config.Stats.Kills, Config.Stats.Best } do
		local value = Instance.new("IntValue")
		value.Name = statName
		value.Parent = leaderstats
	end
	leaderstats.Parent = player

	resetSurvival(player)

	local function onCharacterAdded(character)
		resetSurvival(player)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.Died:Connect(function()
			local days = PlayerData.getStat(player, Config.Stats.Days)
			if days then
				days.Value = 0
			end
			PlayerData.notify(player, "Ты погиб! Все ресурсы потеряны.", "bad")
		end)
	end
	player.CharacterAdded:Connect(onCharacterAdded)
	if player.Character then
		task.spawn(onCharacterAdded, player.Character)
	end

	task.spawn(loadRecord, player, PlayerData.getStat(player, Config.Stats.Best))
end

function PlayerData.start()
	Players.PlayerAdded:Connect(onPlayerAdded)
	for _, player in Players:GetPlayers() do
		task.spawn(onPlayerAdded, player)
	end

	Players.PlayerRemoving:Connect(function(player)
		saveRecord(player)
		loadedRecords[player] = nil
	end)

	game:BindToClose(function()
		for _, player in Players:GetPlayers() do
			task.spawn(saveRecord, player)
		end
		task.wait(2)
	end)
end

return PlayerData
