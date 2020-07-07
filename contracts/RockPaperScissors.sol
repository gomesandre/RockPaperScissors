pragma solidity ^0.5.0;

contract RockPaperScissors {
  enum Move { Rock, Paper, Scissors }
  
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
  
  event LogGameCreated(bytes32 gameID, address player, Move movement);
  event LogGameJoined(bytes32 gameID, address player, Move movement);
  event LogGameResult(address winner);
  event LogWagerClaimedBack(bytes32 gameID);
  event LogWithdrawn(address indexed sender, uint amount);
  
  function newGame(Move movement) public payable {
    require(msg.value > 0, "Send at least 1 wei.");

    bytes32 gameID = keccak256(abi.encodePacked(address(this), now));
    uint deadline = now + 2 minutes;
    games[gameID] = Game(msg.sender, address(0), movement, Move(0), msg.value, deadline);
    
    emit LogGameCreated(gameID, msg.sender, movement);
  }
  
  function joinGame(bytes32 gameID, Move movement) public payable {
    require(games[gameID].expiresAt > now, "Game expired.");
    require(games[gameID].playerOne != msg.sender, "Can't play against yourself.");
    require(msg.value > 0, "Send at least 1 wei.");
    require(msg.value == games[gameID].wagered, "Your wager must be the same value that your adversary.");
    
    games[gameID].wagered += msg.value;
    games[gameID].playerTwo = msg.sender;
    games[gameID].playerTwoMove = movement;
    emit LogGameJoined(gameID, msg.sender, movement);
    
    address winner = getGameResult(gameID);
    updateBalances(gameID, winner);
    emit LogGameResult(winner);
  }
  
  function updateBalances(bytes32 gameID, address winner) public {
    uint bets = games[gameID].wagered;
    games[gameID].wagered = 0;
    
    if(winner == address(0)) {
      uint splitted = bets / 2;
      balances[games[gameID].playerOne] += splitted;
      balances[games[gameID].playerTwo] += splitted;
    } else {
      balances[winner] += bets;
    }
  }
  
  function getGameResult(bytes32 gameID) public view returns (address){
    Game memory g = games[gameID];
    
    Move playerOneMove = g.playerOneMove;
    Move playerTwoMove = g.playerTwoMove;
    
    if(playerOneMove == playerTwoMove) 
      return address(0);
      
    if(playerOneMove == Move.Rock) {
        if(playerTwoMove == Move.Paper)
          return g.playerTwo;
        else
          return g.playerOne;
    }
    
    if(playerOneMove == Move.Paper) {
        if(playerTwoMove == Move.Scissors)
          return g.playerTwo;
        else
          return g.playerOne;
    }
    
    if(playerOneMove == Move.Scissors) {
        if(playerTwoMove == Move.Rock)
          return g.playerTwo;
        else
          return g.playerOne;
    }
  }
  
  function claimWagerExpiredGame(bytes32 gameID) public {
    require(games[gameID].wagered != 0, "Funds already claimed back.");
    require(games[gameID].expiresAt < now, "Can not claim wager until the game is expired.");
    require(games[gameID].playerTwo == address(0), "You can not claim back funds if your adversary joined the game.");
    require(games[gameID].playerOne == msg.sender, "Only game creator can claim funds back.");
    
    uint amount = games[gameID].wagered;
    games[gameID].wagered = 0;
    balances[msg.sender] += amount;
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