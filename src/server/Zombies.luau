-- Зомби: появляются ночью вокруг игроков, преследуют ближайшего, ломают стены, сгорают на рассвете.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage.Shared.Config)
local PlayerData = require(script.Parent.PlayerData)
local World = require(script.Parent.World)

local Zombies = {}

local SKIN_COLOR = Color3.fromRGB(110, 150, 90)
local SHIRT_COLOR = Color3.fromRGB(70, 60, 50)
local PANTS_COLOR = Color3.fromRGB(45, 50, 70)
local WALK_ANIMATION_ID = "rbxassetid://507777826" -- стандартная анимация ходьбы R15

local settings = Config.Zombie
local rng = Random.new()
local active = {} -- [model] = { Model, Humanoid, Root, LastAttack, LastPosition }
local template = nil
local nightToken = 0
local barrierParams = nil

-- Запасной вариант, если не удалось собрать R15-модель: простой "блочный" зомби.
local function buildSimpleZombie()
	local model = Instance.new("Model")
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1)
	root.Color = SHIRT_COLOR
	root.Parent = model

	local function attach(name, size, offset, color)
		local part = Instance.new("Part")
		part.Name = name
		part.Size = size
		part.Color = color
		part.CanCollide = false
		part.CFrame = root.CFrame * offset
		part.Parent = model
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = part
		weld.Parent = root
	end
	attach("Head", Vector3.new(1.2, 1.2, 1.2), CFrame.new(0, 1.6, 0), SKIN_COLOR)
	attach("Legs", Vector3.new(2, 2, 1), CFrame.new(0, -2, 0), PANTS_COLOR)

	local humanoid = Instance.new("Humanoid")
	humanoid.RigType = Enum.HumanoidRigType.R15
	humanoid.HipHeight = 2
	humanoid.Parent = model
	model.PrimaryPart = root
	return model
end

local function buildTemplate()
	local ok, model = pcall(function()
		local description = Instance.new("HumanoidDescription")
		description.HeadColor = SKIN_COLOR
		description.LeftArmColor = SKIN_COLOR
		description.RightArmColor = SKIN_COLOR
		description.TorsoColor = SHIRT_COLOR
		description.LeftLegColor = PANTS_COLOR
		description.RightLegColor = PANTS_COLOR
		return Players:CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15)
	end)
	if not ok or not model then
		warn("Не удалось создать R15-зомби, используем простую модель:", model)
		return buildSimpleZombie()
	end

	-- Вытянутые вперёд руки, как у настоящего зомби
	for _, path in { { "RightUpperArm", "RightShoulder" }, { "LeftUpperArm", "LeftShoulder" } } do
		local arm = model:FindFirstChild(path[1])
		local motor = arm and arm:FindFirstChild(path[2])
		if motor and motor:IsA("Motor6D") then
			motor.C0 *= CFrame.Angles(math.rad(90), 0, 0)
		end
	end
	return model
end

local function playWalkAnimation(humanoid)
	if not humanoid.Parent:FindFirstChild("UpperTorso") then
		return
	end
	local animator = humanoid:FindFirstChildOfClass("Animator")
	if not animator then
		animator = Instance.new("Animator")
		animator.Parent = humanoid
	end
	local animation = Instance.new("Animation")
	animation.AnimationId = WALK_ANIMATION_ID
	local ok, track = pcall(animator.LoadAnimation, animator, animation)
	if not ok then
		return
	end
	track.Looped = true
	humanoid.Running:Connect(function(speed)
		if speed > 0.5 and not track.IsPlaying then
			track:Play()
		elseif speed <= 0.5 and track.IsPlaying then
			track:Stop()
		end
	end)
end

local function aliveCount()
	local count = 0
	for _ in active do
		count += 1
	end
	return count
end

local function spawnZombie(position, day)
	local model = template:Clone()
	model.Name = "Зомби"
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	local root = model:FindFirstChild("HumanoidRootPart")

	local health = settings.Health + settings.HealthPerDay * (day - 1)
	humanoid.MaxHealth = health
	humanoid.Health = health
	humanoid.WalkSpeed = math.min(settings.MaxWalkSpeed, settings.WalkSpeed + settings.WalkSpeedPerDay * (day - 1))
	humanoid.DisplayName = "Зомби"
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOn

	model:PivotTo(CFrame.new(position + Vector3.new(0, 4, 0)))
	model.Parent = World.Folders.Zombies
	pcall(function()
		root:SetNetworkOwner(nil)
	end)
	playWalkAnimation(humanoid)

	active[model] = {
		Model = model,
		Humanoid = humanoid,
		Root = root,
		LastAttack = 0,
		LastPosition = root.Position,
	}

	humanoid.Died:Connect(function()
		active[model] = nil
		local killerId = model:GetAttribute("LastHitBy")
		local killer = killerId and Players:GetPlayerByUserId(killerId)
		if killer then
			PlayerData.addKill(killer)
		end
		task.delay(3, function()
			model:Destroy()
		end)
	end)
end

local function findSpawnPosition()
	local anchors = {}
	for _, player in Players:GetPlayers() do
		local _, _, root = PlayerData.getAliveCharacter(player)
		if root then
			table.insert(anchors, root.Position)
		end
	end
	local anchor = #anchors > 0 and anchors[rng:NextInteger(1, #anchors)] or Vector3.zero

	local half = Config.MapSize / 2 - 10
	for _ = 1, 10 do
		local angle = rng:NextNumber(0, math.pi * 2)
		local distance = rng:NextNumber(settings.SpawnMinDistance, settings.SpawnMaxDistance)
		local x = math.clamp(anchor.X + math.cos(angle) * distance, -half, half)
		local z = math.clamp(anchor.Z + math.sin(angle) * distance, -half, half)
		local result = Workspace:Raycast(Vector3.new(x, 80, z), Vector3.new(0, -200, 0))
		if result and result.Instance == Workspace.Terrain and result.Material ~= Enum.Material.Water then
			return result.Position
		end
	end
	return nil
end

local function findTarget(position)
	local bestHumanoid, bestRoot, bestDistance = nil, nil, math.huge
	for _, player in Players:GetPlayers() do
		local _, humanoid, root = PlayerData.getAliveCharacter(player)
		if humanoid then
			local distance = (root.Position - position).Magnitude
			if distance < bestDistance then
				bestHumanoid, bestRoot, bestDistance = humanoid, root, distance
			end
		end
	end
	return bestHumanoid, bestRoot, bestDistance
end

local function damageBarrier(barrier)
	local health = (barrier:GetAttribute("Health") or 0) - settings.Damage
	barrier:SetAttribute("Health", health)
	if health <= 0 then
		barrier:Destroy()
		return
	end
	-- Чем сильнее повреждена стена, тем она темнее
	local ratio = health / (barrier:GetAttribute("MaxHealth") or Config.Wall.Health)
	barrier.Color = Color3.fromRGB(60, 45, 30):Lerp(Color3.fromRGB(150, 110, 70), ratio)
end

local function step(info, now)
	local humanoid, root = info.Humanoid, info.Root
	if humanoid.Health <= 0 or not root.Parent then
		return
	end

	local targetHumanoid, targetRoot, distance = findTarget(root.Position)
	if not targetHumanoid then
		humanoid:MoveTo(root.Position)
		return
	end
	humanoid:MoveTo(targetRoot.Position)

	local canAttack = now - info.LastAttack >= settings.AttackCooldown
	if distance <= settings.AttackRange then
		if canAttack then
			info.LastAttack = now
			targetHumanoid:TakeDamage(settings.Damage)
		end
		return
	end

	-- Застрял? Если рядом стена — ломаем её, иначе пробуем перепрыгнуть препятствие.
	local moved = (root.Position - info.LastPosition).Magnitude
	info.LastPosition = root.Position
	if moved < 0.5 then
		local barriers = Workspace:GetPartBoundsInRadius(root.Position, 6, barrierParams)
		if #barriers > 0 then
			if canAttack then
				info.LastAttack = now
				damageBarrier(barriers[1])
			end
		else
			humanoid.Jump = true
		end
	end
end

function Zombies.getInRadius(position, radius)
	local result = {}
	for _, info in active do
		if info.Humanoid.Health > 0 and (info.Root.Position - position).Magnitude <= radius then
			table.insert(result, info)
		end
	end
	return result
end

function Zombies.damage(model, amount, attacker)
	local info = active[model]
	if not info then
		return
	end
	model:SetAttribute("LastHitBy", attacker.UserId)
	info.Humanoid:TakeDamage(amount)
end

function Zombies.startNight(day)
	nightToken += 1
	local token = nightToken
	local count = math.min(settings.BaseCount + settings.PerDay * (day - 1), settings.MaxAlive)
	PlayerData.notifyAll("Наступает ночь " .. day .. "! Зомби выходят на охоту: " .. count, "bad")

	for _ = 1, count do
		if token ~= nightToken then
			return
		end
		if aliveCount() < settings.MaxAlive then
			local position = findSpawnPosition()
			if position then
				spawnZombie(position, day)
			end
		end
		task.wait(settings.SpawnInterval)
	end
end

-- На рассвете все зомби загораются и погибают (убийства игрокам не засчитываются).
function Zombies.burnAll()
	nightToken += 1
	for model, info in active do
		model:SetAttribute("LastHitBy", nil)
		local fire = Instance.new("Fire")
		fire.Size = 6
		fire.Parent = info.Root
		task.delay(rng:NextNumber(1, 3), function()
			info.Humanoid.Health = 0
		end)
	end
end

function Zombies.start()
	template = buildTemplate()

	barrierParams = OverlapParams.new()
	barrierParams.FilterType = Enum.RaycastFilterType.Include
	barrierParams.FilterDescendantsInstances = { World.Folders.Barriers }

	task.spawn(function()
		while true do
			task.wait(0.2)
			local now = os.clock()
			for _, info in active do
				step(info, now)
			end
		end
	end)
end

return Zombies
