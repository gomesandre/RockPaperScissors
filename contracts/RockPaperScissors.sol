pragma solidity ^0.5.0;

import "./SafeMath.sol";

contract RockPaperScissors {
  using SafeMath for uint256;

  enum Move { Unset, Rock, Paper, Scissors }
  
  struct Game {
    address playerOne;
    address playerTwo;
    Move playerOneMove;
    Move playerTwoMove;
    uint wagered;
    uint expiresAt;
  }
  
  mapping (address => uint) public balances;
  mapping (bytes32 => Game) public games;
  
  event LogGameCreated(bytes32 gameID, address player);
  event LogGameJoined(bytes32 gameID, address player, Move movement);
  event LogGameResult(address winner);
  event LogWagerClaimedBack(bytes32 gameID);
  event LogWithdrawn(address indexed sender, uint amount);
  
  function hashData(Move movement, bytes32 password) public view returns (bytes32) {
    require(movement != Move.Unset, "You must enter a valid movement.");
    require(password != bytes32(0), "You must enter a valid password.");
    return keccak256(abi.encodePacked(address(this), movement, password, msg.sender));
  }
  
  function newGame(bytes32 hash, uint minutesToExpire) public payable {
    require(msg.value > 0, "Send at least 1 wei.");
    require(hash != bytes32(0), "Invalid starting hash.");
    require(games[hash].playerOne == address(0), "Starting hash already used.");
    
    uint deadline = now.add(minutesToExpire.mul(1 minutes));
    games[hash] = Game(msg.sender, address(0), Move.Unset, Move.Unset, msg.value, deadline);
    
    emit LogGameCreated(hash, msg.sender);
  }
  
  function joinGame(bytes32 gameID, Move movement) public payable {
    require(games[gameID].expiresAt > now, "Game expired.");
    require(games[gameID].playerOne != msg.sender, "Can't play against yourself.");
    require(msg.value == games[gameID].wagered, "Your wager must be the same value that your adversary.");
    
    games[gameID].wagered = games[gameID].wagered.add(msg.value);
    games[gameID].playerTwo = msg.sender;
    games[gameID].playerTwoMove = movement;
    
    emit LogGameJoined(gameID, msg.sender, movement);
  }
  
  function play(bytes32 hash, bytes32 password) public {
    require(games[hash].expiresAt > now, "This game has expired.");
    require(games[hash].playerTwo != address(0), "Player Two did not entered yet.");
    require(games[hash].playerOne == msg.sender, "Only Player One can run results.");
    
    Move plainMovement = getPlainMovement(hash, password);
    address winner = getGameResult(hash, plainMovement);
    updateBalances(hash, winner);
    clearGame(hash);
    
    emit LogGameResult(winner);
  }

  function getPlainMovement(bytes32 hash, bytes32 password) public view returns (Move) {
    if(hash == hashData(Move.Rock, password))
      return Move.Rock;
    else if (hash == hashData(Move.Paper, password))
      return Move.Paper;
    else
      return Move.Scissors;
  }

  function getGameResult(bytes32 hash, Move playerOneMove) public view returns (address) {
    if(playerOneMove == games[hash].playerTwoMove)
      return address(0);
      
    if(playerOneMove == Move.Rock)
      return games[hash].playerTwoMove == Move.Paper ? games[hash].playerTwo : games[hash].playerOne;
    
    if(playerOneMove == Move.Paper)
      return games[hash].playerTwoMove == Move.Scissors ? games[hash].playerTwo : games[hash].playerOne;

    if(playerOneMove == Move.Scissors)
      return games[hash].playerTwoMove == Move.Rock ? games[hash].playerTwo : games[hash].playerOne;
  }
  
  function updateBalances(bytes32 gameID, address winner) public {
    uint bets = games[gameID].wagered;
    address playerOne = games[gameID].playerOne;
    address playerTwo = games[gameID].playerTwo;
    
    games[gameID].wagered = 0;
        
    if(winner == address(0)) {
      uint splitted = bets.div(2);
      balances[playerOne] = balances[playerOne].add(splitted);
      balances[playerTwo] = balances[playerTwo].add(splitted);
    } else {
      balances[winner] = balances[winner].add(bets);
    }
  }

  function clearGame(bytes32 hash) public {
    games[hash].playerOne = address(0);
    games[hash].playerTwo = address(0);
    games[hash].playerOneMove = Move(0);
    games[hash].playerTwoMove = Move(0);
    games[hash].wagered = uint(0);
    games[hash].expiresAt = uint(0);
  }
  
  function releaseFundsNoSecondPlayer(bytes32 gameID) public {
    require(games[gameID].wagered != 0, "Funds already claimed back.");
    require(games[gameID].expiresAt < now, "Can not claim wager until the game is expired.");
    require(games[gameID].playerTwo == address(0), "You can not claim back funds if your adversary joined the game.");
    require(games[gameID].playerOne == msg.sender, "Only game creator can claim funds back.");
    
    uint amount = games[gameID].wagered;
    games[gameID].wagered = 0;
    balances[msg.sender] = balances[msg.sender].add(amount);
    
    emit LogWagerClaimedBack(gameID);
  }
  
  function withdraw() public {
      uint amount = balances[msg.sender];
      require(amount > 0, "Insufficient funds.");
      balances[msg.sender] = 0;
      emit LogWithdrawn(msg.sender, amount);
      (bool success, ) = msg.sender.call.value(amount)("");
      require(success, "Transfer failed.");
  }
}