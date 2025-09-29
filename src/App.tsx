import React, { useState, useEffect, useRef, useCallback } from "react";

// TODO
// do the math on arm angle calculations in caculateArm to get the arms to be actually straight
// Big Head mode 
// high score list (locally)
// something happens after 60s (earthquake or something)


const calculateArm = (
  shoulderX,
  shoulderY,
  armLength,
  forearmLength,
  armAngle,
  forearmAngle,
  whichArm,
) => {
  armAngle = Math.min(armAngle, Math.PI / 2)
  forearmAngle = Math.min(forearmAngle, Math.PI)

  const directionMult = whichArm == "right" ? 1 : -1;
  const elbowX = shoulderX + armLength * Math.cos(armAngle) * directionMult;
  const elbowY = shoulderY + armLength * Math.sin(armAngle);
  const handX = elbowX + forearmLength * Math.cos(forearmAngle + armAngle) * directionMult;
  const handY = elbowY + forearmLength * Math.sin(forearmAngle + armAngle);
  
  return { elbowX, elbowY, handX, handY };
};

const armCenter = ({ elbowX, elbowY, handX, handY }) => {
  const x = elbowX * 0.7 + handX * 0.3;
  const y = elbowY * 0.7 + handY * 0.3;
  return { x, y };
};

const BalanceGame = () => {
  const canvasRef = useRef(null);
  const animationRef: React.Ref<number | null> = useRef(null);
  const [gameState, setGameState] = useState("playing"); // 'playing', 'gameOver'
  const scoreRef = useRef(0);
  const mouseRef = useRef({ x: 400, y: 300, side: "left" });
  // Keys state
  const keysPressed = useRef({})

  // Physics state
  const physicsRef = useRef({
    angle: 0, // lean angle in radians
    angularVelocity: 0,
    basePosX: 400,
    time: 0,
    leftArmAngle: 0,
    leftForearmAngle: 0,
    rightArmAngle: 0,
    rightForearmAngle: 0,
  });

  const returnArmsToNeutral = useCallback(() => {
    const pressure = 0.05
    const physics = physicsRef.current
    if(physics.leftArmAngle > 0){
      physics.leftArmAngle -= pressure
    }
    if(physics.rightArmAngle > 0){
      physics.rightArmAngle -= pressure
    }
    if(physics.rightForearmAngle > 0){
      physics.rightForearmAngle -= pressure
    }
    if(physics.leftForearmAngle > 0){
      physics.leftForearmAngle -= pressure
    }
  }, [])

  const calculateBody = useCallback(() => {
    const canvas = canvasRef.current;
    const physics = physicsRef.current;
    const mousePos = mouseRef.current;

    // Figure dimensions
    const headRadius = 20;
    const bodyLength = 100;
    const legLength = 120;
    const armLength = 40;
    const forearmLength = 45;

    // Positions
    const footY = canvas.height - 50;
    const hipY = footY - legLength;
    const shoulderY = hipY - bodyLength;
    const headY = shoulderY - headRadius - 10;

    const leftArm = calculateArm(
      physics.basePosX + Math.sin(physics.angle),
      shoulderY,
      armLength,
      forearmLength,
      physics.leftArmAngle,
      physics.leftForearmAngle,
      "left",
    );

    const rightArm = calculateArm(
      physics.basePosX + Math.sin(physics.angle),
      shoulderY,
      armLength,
      forearmLength,
      physics.rightArmAngle,
      physics.rightForearmAngle,
      "right",
    );

    return {
      headRadius,
      bodyLength,
      legLength,
      armLength1: armLength,
      armLength2: forearmLength,
      footY,
      hipY,
      shoulderY,
      headY,
      leftArm,
      rightArm,
    };
  });

  const updatePhysics = useCallback((deltaTime) => {
    const physics = physicsRef.current;

    const body = calculateBody();

    // Calculate torque based on arm positions and center of mass
    const armWeight = 0.3; // Weight contribution of arms
    const bodyWeight = 0.7; // Weight of body

    // Body center of mass shifts with lean
    const bodyCenterX = physics.basePosX + Math.sin(physics.angle) * 100;

    const leftArmCenterX = armCenter(body.leftArm).x;
    const rightArmCenterX = armCenter(body.rightArm).x;
    // Calculate arm center of mass offset based on mouse position
    const armCenterX = (leftArmCenterX + rightArmCenterX) / 2;

    // Combined center of mass (proper weighted average)
    const totalCenterX =
      (bodyCenterX * bodyWeight + armCenterX * armWeight) /
      (bodyWeight + armWeight);

    // Calculate torque (distance from support point)
    const torque = (totalCenterX - physics.basePosX) * 0.0008;

    // Add some random disturbance for difficulty (reduced)
    const disturbance = (Math.random() - 0.5) * 0.0002;

    // Update angular velocity and angle
    physics.angularVelocity += (torque + disturbance) * deltaTime * 0.005; // Scale down by 0.001 for milliseconds
    physics.angularVelocity *= 0.99; // Damping
    physics.angle += physics.angularVelocity * deltaTime * 0.005;

    // Check if fallen
    if (Math.abs(physics.angle) > Math.PI / 3) {
      // Fall at 60 degrees
      return false; // Game over
    }

    return true; // Still balancing
  }, []);

  const updateInput = useCallback(() => {
    const physics = physicsRef.current;
     for(const key of Object.keys(keysPressed.current)) {
      switch (key) {
        case ".":
          physics.rightForearmAngle = Math.min(physics.rightForearmAngle + 0.1, Math.PI);
          break;
        case ",":
          physics.rightArmAngle = Math.min(physics.rightArmAngle + 0.1, Math.PI / 2);
          break;
        case "z":
          physics.leftArmAngle = Math.min(physics.leftArmAngle + 0.1, Math.PI / 2);

          break;
        case "x":
          physics.leftForearmAngle = Math.min(physics.leftForearmAngle + 0.1, Math.PI);

          break;
        case "r":
          resetGame();
          break;
        default:
          break;
      }
    }
  }, []);

  const draw = useCallback((ctx, canvas, score) => {
    const physics = physicsRef.current;
    const mousePos = mouseRef.current;

    const body = calculateBody();

    // Clear canvas
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = "#8B7355";
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Save transform
    ctx.save();

    // Apply lean transformation
    ctx.translate(physics.basePosX, canvas.height - 50);
    ctx.rotate(physics.angle);
    ctx.translate(-physics.basePosX, -(canvas.height - 50));

    // Draw standing leg
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(physics.basePosX, body.footY);
    ctx.lineTo(physics.basePosX, body.hipY);
    ctx.stroke();

    // Draw raised leg (bent)
    ctx.beginPath();
    ctx.moveTo(physics.basePosX, body.hipY);
    ctx.lineTo(physics.basePosX - 30, body.hipY + 40);
    ctx.lineTo(physics.basePosX - 25, body.hipY + 80);
    ctx.stroke();

    // Draw body
    ctx.beginPath();
    ctx.moveTo(physics.basePosX, body.hipY);
    ctx.lineTo(physics.basePosX, body.shoulderY);
    ctx.stroke();

    // Draw left arm
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(physics.basePosX - 5, body.shoulderY);
    ctx.lineTo(body.leftArm.elbowX, body.leftArm.elbowY);
    ctx.lineTo(body.leftArm.handX, body.leftArm.handY);
    ctx.stroke();

    // Draw right arm
    ctx.beginPath();
    ctx.moveTo(physics.basePosX + 5, body.shoulderY);
    ctx.lineTo(body.rightArm.elbowX, body.rightArm.elbowY);
    ctx.lineTo(body.rightArm.handX, body.rightArm.handY);
    ctx.stroke();

    // Draw hands
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.arc(body.leftArm.handX, body.leftArm.handY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(body.rightArm.handX, body.rightArm.handY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw head
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.arc(physics.basePosX, body.headY, body.headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw face
    ctx.fillStyle = "#000";
    // Eyes
    ctx.beginPath();
    ctx.arc(physics.basePosX - 7, body.headY - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(physics.basePosX + 7, body.headY - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (changes based on lean)
    ctx.beginPath();
    if (Math.abs(physics.angle) > Math.PI / 6) {
      // Worried face
      ctx.arc(
        physics.basePosX,
        body.headY + 8,
        5,
        Math.PI * 0.2,
        Math.PI * 0.8,
      );
    } else {
      // Smile
      ctx.arc(physics.basePosX, body.headY + 3, 5, 0, Math.PI);
    }
    ctx.stroke();

    ctx.restore();

    // Draw UI
    ctx.fillStyle = "#000";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`Time: ${scoreRef.current.toFixed(1)}s`, 20, 40);

    // Draw balance indicator
    const indicatorWidth = 200;
    const indicatorX = canvas.width / 2 - indicatorWidth / 2;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(indicatorX, 20, indicatorWidth, 20);

    const balanceRatio = (physics.angle + Math.PI / 3) / ((Math.PI * 2) / 3);
    const balanceX = indicatorX + balanceRatio * indicatorWidth;

    ctx.fillStyle =
      Math.abs(physics.angle) > Math.PI / 6 ? "#FF6B6B" : "#4CAF50";
    ctx.fillRect(balanceX - 5, 18, 10, 24);
  }, []);

  const gameLoop = useCallback(
    (timestamp) => {
      if (gameState !== "playing") return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      // Initialize time on first frame
      if (physicsRef.current.time === 0) {
        physicsRef.current.time = timestamp;
        draw(ctx, canvas, scoreRef.current);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const deltaTime = timestamp - physicsRef.current.time;
      physicsRef.current.time = timestamp;

      returnArmsToNeutral(); 

      updateInput();

      // Update physics
      if (deltaTime < 100) {
        // Prevent huge jumps
        const stillBalancing = updatePhysics(deltaTime);

        if (!stillBalancing) {
          setGameState("gameOver");
          return;
        }

        // Update score
        scoreRef.current += deltaTime / 1000;
      }

      // Draw
      draw(ctx, canvas, scoreRef.current);

      animationRef.current = requestAnimationFrame(gameLoop);
    },
    [gameState, updatePhysics],
  );

  // Handle mouse/touch movement
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      side: mouseRef.current.side,
    };
  }, []);



  const handleKeyUp = useCallback((e) => {
    delete keysPressed.current[e.key];
  }, [])

  const handleKeyDown = useCallback((e) => {
    const physics = physicsRef.current;
    keysPressed.current[e.key] = true;
    if(e.key == "r"){
      resetGame();
    }
  }, []);
  


  // Reset game
  // TODO: Wrap in useCallback
  const resetGame = () => {
    physicsRef.current = {
      angle: 0,
      angularVelocity: 0,
      basePosX: 400,
      time: 0,
      leftArmAngle: 0,
      leftForearmAngle: 0,
      rightArmAngle: 0,
      rightForearmAngle: 0,
    };
    scoreRef.current = 0;
    setGameState("playing");
    keysPressed.current = {};
  };

  // Start game loop
  useEffect(() => {
    if (gameState === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, gameLoop]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-4">
          Balance Challenge
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Move your cursor to control the arms. Keep balanced as long as
          possible!
        </p>

        <canvas
          ref={canvasRef}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          tabIndex={0}
          width={800}
          height={600}
          className="border border-gray-300 rounded cursor-none"
        />

        {gameState === "gameOver" && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 shadow-xl">
              <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
              <p className="text-lg mb-6">
                You balanced for {scoreRef.current.toFixed(1)} seconds!
              </p>
              <button
                onClick={resetGame}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceGame;
