pragma solidity ^0.5.0;

import "./SafeMath.sol";

contract RockPaperScissors {
  using SafeMath for uint256;

  enum Move { Unset, Rock, Paper, Scissors }
  
  struct Game {
    address playerOne;
    address playerTwo;
    Move playerTwoMove;
    uint wagered;
    uint expiresAt;
    uint minutesToExpire;
  }
  
  mapping (address => uint) public balances;
  mapping (bytes32 => Game) public games;
  
  event LogGameCreated(bytes32 indexed gameID, address indexed player);
  event LogGameJoined(bytes32 indexed gameID, address indexed player, Move movement);
  event LogGameResult(address indexed winner);
  event LogWagerClaimedBack(bytes32 indexed gameID, address indexed claimer);
  event LogWithdrawn(address indexed sender, uint amount);
  
  function hashData(Move movement, bytes32 password) public view returns (bytes32) {
    require(movement != Move.Unset, "You must enter a valid movement.");
    require(password != bytes32(0), "You must enter a valid password.");
    return keccak256(abi.encodePacked(address(this), movement, password, msg.sender));
  }
  
  function newGame(bytes32 hash, address playerTwo, uint minutesToExpire) public payable {
    require(msg.value > 0, "Send at least 1 wei.");
    require(hash != bytes32(0), "Invalid starting hash.");
    require(playerTwo != address(0), "Invalid address for player two.");
    require(games[hash].playerOne == address(0), "Starting hash already used.");
    
    uint deadline = now.add(minutesToExpire.mul(1 minutes));
    games[hash] = Game(msg.sender, playerTwo, Move.Unset, msg.value, deadline, minutesToExpire);
    
    emit LogGameCreated(hash, msg.sender);
  }
  
  function joinGame(bytes32 gameID, Move movement) public payable {
    require(games[gameID].expiresAt > now, "Game expired.");
    require(games[gameID].playerOne != msg.sender, "Can't play against yourself.");
    require(games[gameID].playerTwo == msg.sender, "You do not have permission to join this game.");
    require(games[gameID].playerTwoMove == Move.Unset, "You can not join the same game two times.");
    require(games[gameID].wagered == msg.value, "Your wager must be the same value that your adversary.");

    games[gameID].wagered = games[gameID].wagered.add(msg.value);
    games[gameID].playerTwoMove = movement;
    games[gameID].expiresAt = now.add(games[gameID].minutesToExpire.mul(1 minutes));

    emit LogGameJoined(gameID, msg.sender, movement);
  }
  
  function play(bytes32 hash, bytes32 password) public {
    require(games[hash].expiresAt > now, "This game has expired.");
    require(games[hash].playerTwoMove != Move.Unset, "Player Two did not entered yet.");
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
    games[hash].playerTwo = address(0);
    games[hash].playerTwoMove = Move(0);
    games[hash].wagered = uint(0);
    games[hash].expiresAt = uint(0);
  }
  
  function releaseFundsNoSecondPlayer(bytes32 gameID) public {
    require(games[gameID].wagered != 0, "Funds already claimed back.");
    require(games[gameID].expiresAt < now, "Can not claim wager until the game is expired.");
    require(games[gameID].playerTwoMove == Move.Unset, "You can not claim back funds if your adversary joined the game.");
    require(games[gameID].playerOne == msg.sender, "Only game creator can claim funds back.");
    
    uint amount = games[gameID].wagered;
    clearGame(gameID);
    balances[msg.sender] = balances[msg.sender].add(amount);
    
    emit LogWagerClaimedBack(gameID, msg.sender);
  }
  
  function releaseFundsGameExpired(bytes32 gameID) public {
    require(games[gameID].wagered != 0, "Funds already claimed back.");
    require(games[gameID].expiresAt < now, "Can not claim wager until the game is expired.");
    require(games[gameID].playerTwo == msg.sender, "Only player two can claim funds back.");
    require(games[gameID].playerTwoMove != Move.Unset, "Player One can not start game without player two.");
    
    uint amount = games[gameID].wagered;
    clearGame(gameID);
    balances[msg.sender] = balances[msg.sender].add(amount);
    
    emit LogWagerClaimedBack(gameID, msg.sender);
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