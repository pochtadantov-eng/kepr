-- Крафт предметов: меч, костёр и деревянная стена.
local Debris = game:GetService("Debris")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage.Shared.Config)
local PlayerData = require(script.Parent.PlayerData)
local World = require(script.Parent.World)
local Zombies = require(script.Parent.Zombies)
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local Crafting = {}

local recipesById = {}
for _, recipe in Config.Recipes do
	recipesById[recipe.Id] = recipe
end

local function hasSword(player)
	local backpack = player:FindFirstChildOfClass("Backpack")
	local character = player.Character
	return (backpack and backpack:FindFirstChild(Config.Sword.Name))
		or (character and character:FindFirstChild(Config.Sword.Name))
end

-- Точка на земле перед игроком и направление его взгляда (без наклона).
local function groundInFront(root, distance)
	local look = root.CFrame.LookVector * Vector3.new(1, 0, 1)
	look = look.Magnitude > 0.01 and look.Unit or Vector3.new(0, 0, -1)
	local origin = root.Position + look * distance + Vector3.new(0, 10, 0)

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { root.Parent, World.Folders.Zombies }
	local result = Workspace:Raycast(origin, Vector3.new(0, -40, 0), params)
	local y = result and result.Position.Y or root.Position.Y - 3
	return Vector3.new(origin.X, y, origin.Z), look
end

local function weldPart(handle, props)
	local part = Instance.new("Part")
	part.CanCollide = false
	part.Massless = true
	for key, value in props do
		part[key] = value
	end
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = handle
	weld.Part1 = part
	weld.Parent = part
	return part
end

local builders = {}

function builders.Sword(player)
	local tool = Instance.new("Tool")
	tool.Name = Config.Sword.Name
	tool.ToolTip = "Нажми ЛКМ, чтобы ударить"
	tool.CanBeDropped = false
	-- Хват как у классического меча Roblox
	tool.GripForward = Vector3.new(-1, 0, 0)
	tool.GripPos = Vector3.new(0, 0, -1.5)
	tool.GripRight = Vector3.new(0, 1, 0)
	tool.GripUp = Vector3.new(0, 0, 1)

	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(0.3, 0.6, 4.4)
	handle.Color = Color3.fromRGB(200, 200, 210)
	handle.Material = Enum.Material.Metal
	handle.CanCollide = false
	handle.Parent = tool

	weldPart(handle, {
		Name = "Guard",
		Size = Vector3.new(0.4, 1.6, 0.3),
		CFrame = handle.CFrame * CFrame.new(0, 0, -1.2),
		Color = Color3.fromRGB(90, 60, 35),
		Material = Enum.Material.Wood,
		Parent = tool,
	})
	weldPart(handle, {
		Name = "Hilt",
		Size = Vector3.new(0.35, 0.35, 1),
		CFrame = handle.CFrame * CFrame.new(0, 0, -1.9),
		Color = Color3.fromRGB(90, 60, 35),
		Material = Enum.Material.Wood,
		Parent = tool,
	})

	local lastSwing = 0
	tool.Activated:Connect(function()
		local now = os.clock()
		if now - lastSwing < Config.Sword.Cooldown then
			return
		end
		local _, _, root = PlayerData.getAliveCharacter(player)
		if not root or tool.Parent ~= player.Character then
			return
		end
		lastSwing = now

		-- Стандартный скрипт анимации Roblox проигрывает взмах, увидев этот StringValue
		local slash = Instance.new("StringValue")
		slash.Name = "toolanim"
		slash.Value = "Slash"
		slash.Parent = tool
		Debris:AddItem(slash, 1)

		for _, info in Zombies.getInRadius(root.Position, Config.Sword.Range) do
			local offset = (info.Root.Position - root.Position) * Vector3.new(1, 0, 1)
			if offset.Magnitude < 2 or root.CFrame.LookVector:Dot(offset.Unit) > 0.2 then
				Zombies.damage(info.Model, Config.Sword.Damage, player)
			end
		end
	end)

	tool.Parent = player:FindFirstChildOfClass("Backpack")
end

function builders.Campfire(_player, root)
	local position = groundInFront(root, 5)
	local model = Instance.new("Model")
	model.Name = "Костёр"

	local base = Instance.new("Part")
	base.Name = "Stones"
	base.Anchored = true
	base.Shape = Enum.PartType.Cylinder
	base.Size = Vector3.new(0.6, 4, 4)
	base.CFrame = CFrame.new(position + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90))
	base.Color = Color3.fromRGB(90, 90, 95)
	base.Material = Enum.Material.Slate
	base.Parent = model

	local logs = nil
	for _, angle in { 45, -45 } do
		local log = Instance.new("Part")
		log.Name = "Log"
		log.Anchored = true
		log.CanCollide = false
		log.Size = Vector3.new(0.6, 0.6, 3.4)
		log.CFrame = CFrame.new(position + Vector3.new(0, 0.9, 0)) * CFrame.Angles(0, math.rad(angle), 0)
		log.Color = Color3.fromRGB(95, 60, 35)
		log.Material = Enum.Material.Wood
		log.Parent = model
		logs = log
	end

	local fire = Instance.new("Fire")
	fire.Size = 6
	fire.Heat = 9
	fire.Parent = logs

	local light = Instance.new("PointLight")
	light.Range = 24
	light.Brightness = 2
	light.Color = Color3.fromRGB(255, 170, 90)
	light.Parent = logs

	model.PrimaryPart = base
	model.Parent = World.Folders.Campfires
	Debris:AddItem(model, Config.Campfire.Lifetime)
end

function builders.Wall(_player, root)
	local position, look = groundInFront(root, 6)
	local center = position + Vector3.new(0, 4, 0)

	local wall = Instance.new("Part")
	wall.Name = "Стена"
	wall.Anchored = true
	wall.Size = Vector3.new(12, 8, 1.5)
	wall.CFrame = CFrame.lookAt(center, center + look)
	wall.Color = Color3.fromRGB(150, 110, 70)
	wall.Material = Enum.Material.WoodPlanks
	wall:SetAttribute("Health", Config.Wall.Health)
	wall:SetAttribute("MaxHealth", Config.Wall.Health)
	wall.Parent = World.Folders.Barriers
end

local function healNearCampfires()
	local campfires = World.Folders.Campfires:GetChildren()
	if #campfires == 0 then
		return
	end
	for _, player in Players:GetPlayers() do
		local _, humanoid, root = PlayerData.getAliveCharacter(player)
		if not humanoid then
			continue
		end
		for _, campfire in campfires do
			if (campfire:GetPivot().Position - root.Position).Magnitude <= Config.Campfire.HealRadius then
				humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + Config.Campfire.HealPerSecond)
				break
			end
		end
	end
end

function Crafting.start()
	local lastCraft = {}
	Players.PlayerRemoving:Connect(function(player)
		lastCraft[player] = nil
	end)

	Remotes.Craft.OnServerEvent:Connect(function(player, recipeId)
		local recipe = typeof(recipeId) == "string" and recipesById[recipeId]
		if not recipe then
			return
		end
		local now = os.clock()
		if lastCraft[player] and now - lastCraft[player] < 0.3 then
			return
		end
		lastCraft[player] = now

		local _, _, root = PlayerData.getAliveCharacter(player)
		if not root then
			return
		end
		if recipe.Id == "Sword" and hasSword(player) then
			PlayerData.notify(player, "У тебя уже есть меч", "warn")
			return
		end
		if not PlayerData.hasItems(player, recipe.Cost) then
			PlayerData.notify(player, "Не хватает ресурсов", "warn")
			return
		end

		PlayerData.removeItems(player, recipe.Cost)
		builders[recipe.Id](player, root)
		PlayerData.notify(player, "Создано: " .. recipe.Name, "good")
	end)

	task.spawn(function()
		while true do
			task.wait(1)
			healNearCampfires()
		end
	end)
end

return Crafting
