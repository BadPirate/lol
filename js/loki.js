$(document).ready(function() {
  var explorer_tx = "https://coinb.in/tx/"
  var explorer_addr = "https://coinb.in/addr/"
  var explorer_block = "https://coinb.in/block/"

  $("#redeemFromBtnLoki").click(function(){
		var redeem = redeemingFrom($("#redeemFrom").val());
    $("#refundAddress").val($("#redeemFrom").val());

		$("#redeemFromStatus, #redeemFromAddress, #step2").addClass('hidden');

		if(redeem.from=='multisigAddress'){
			$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> You should use the redeem script, not the multisig address!');
			return false;
		}

		if(redeem.from=='other'){
			$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> The address or multisig redeem script you have entered is invalid');
			return false;
		}

    $("#inputs .txidRemove, #inputs .txidClear").click();

		$("#redeemFromBtnLoki").html("Please wait, loading...").attr('disabled',true);

		var host = $(this).attr('rel');

    listUnspentDefault(redeem);

		if($("#redeemFromStatus").hasClass("hidden")) {
			// An ethical dilemma: Should we automatically set nLockTime?
			if(redeem.from == 'redeemScript' && redeem.decodedRs.type == "hodl__") {
				$("#nLockTime").val(redeem.decodedRs.checklocktimeverify);
			} else {
				$("#nLockTime").val(0);
			}
		}
	});

  $("#amountToSend, #transactionFeeAmount").change(function() {
    updateRefund();
  });

  function updateRefund() {
    $("#refundAmount").val($("#totalInput").html()-$("#transactionFeeAmount").val()-$("#amountToSend").val());
  }

  $("#transactionBtnLoki").click(function(){
    updateRefund();
    var tx = coinjs.transaction();
    var estimatedTxSize = 10; // <4:version><1:txInCount><1:txOutCount><4:nLockTime>

    $("#transactionCreateStatus, #step3").addClass("hidden");

    $("#inputs .row").removeClass('has-error');

    if($("#refundAmount").val() < 0) {
      $("#transactionCreateStatus").removeClass("hidden").html("Insufficient funds").fadeOut().fadeIn();
      $("#amountToSendRow").addClass("has-error");
      return;
    }

    $('#putTabs a[href="#txinputs"], #putTabs a[href="#txoutputs"]').attr('style','');

    $.each($("#inputs .row"), function(i,o){
      if(!($(".txId",o).val()).match(/^[a-f0-9]+$/i)){
        $(o).addClass("has-error");
      } else if((!($(".txIdScript",o).val()).match(/^[a-f0-9]+$/i)) && $(".txIdScript",o).val()!=""){
        $(o).addClass("has-error");
      } else if (!($(".txIdN",o).val()).match(/^[0-9]+$/i)){
        $(o).addClass("has-error");
      }

      if(!$(o).hasClass("has-error")){
        var seq = null;
        if($("#txRBF").is(":checked")){
          seq = 0xffffffff-2;
        }

        var currentScript = $(".txIdScript",o).val();
        if (currentScript.match(/^76a914[0-9a-f]{40}88ac$/)) {
          estimatedTxSize += 147
        } else if (currentScript.match(/^5[1-9a-f](?:210[23][0-9a-f]{64}){1,15}5[1-9a-f]ae$/)) {
          // <74:persig <1:push><72:sig><1:sighash> ><34:perpubkey <1:push><33:pubkey> > <32:prevhash><4:index><4:nSequence><1:m><1:n><1:OP>
          var scriptSigSize = (parseInt(currentScript.slice(1,2),16) * 74) + (parseInt(currentScript.slice(-3,-2),16) * 34) + 43
          // varint 2 bytes if scriptSig is > 252
          estimatedTxSize += scriptSigSize + (scriptSigSize > 252 ? 2 : 1)
        } else {
          // underestimating won't hurt. Just showing a warning window anyways.
          estimatedTxSize += 147
        }

        tx.addinput($(".txId",o).val(), $(".txIdN",o).val(), $(".txIdScript",o).val(), seq);
      } else {
        $('#putTabs a[href="#txinputs"]').attr('style','color:#a94442;');
      }
    });

    $("#recipients .row").removeClass('has-error');

    $.each($("#recipients .row"), function(i,o){
      var a = ($(".address",o).val());
      var ad = coinjs.addressDecode(a);
      if(((a!="") && (ad.version == coinjs.pub || ad.version == coinjs.multisig)) && $(".amount",o).val()!=""){ // address
        if($(".amount",o).val() != 0) {
          // P2SH output is 32, P2PKH is 34
          estimatedTxSize += (ad.version == coinjs.pub ? 34 : 32);
          tx.addoutput(a, $(".amount",o).val());
        }
      } else if (((a!="") && ad.version === 42) && $(".amount",o).val()!=""){ // stealth address
        // 1 P2PKH and 1 OP_RETURN with 36 bytes, OP byte, and 8 byte value
        estimatedTxSize += 78
        tx.addstealth(ad, $(".amount",o).val());
      } else if (((($("#opReturn").is(":checked")) && a.match(/^[a-f0-9]+$/ig)) && a.length<160) && (a.length%2)==0) { // data
        estimatedTxSize += (a.length / 2) + 1 + 8
        tx.adddata(a);
      } else { // neither address nor data
        $(o).addClass('has-error');
        $('#putTabs a[href="#txoutputs"]').attr('style','color:#a94442;');
      }
    });

    if(!$("#recipients .row, #inputs .row").hasClass('has-error')){

      $("#transactionCreate textarea").val(tx.serialize());
      $("#transactionCreate .txSize").html(tx.size());

      if($("#feesestnewtx").attr('est')=='y'){
        $("#fees .txhex").val($("#transactionCreate textarea").val());
        $("#feesAnalyseBtn").click();
        $("#fees .txhex").val("");
        window.location = "#fees";
      } else {

        $("#step3").removeClass("hidden");

        // Check fee against hard 0.01 as well as fluid 200 satoshis per byte calculation.
        if($("#transactionFee").val()>=0.01 || $("#transactionFee").val()>= estimatedTxSize * 200 * 1e-8){
          $("#modalWarningFeeAmount").html($("#transactionFee").val());
          $("#modalWarningFee").modal("show");
        }
      }
      $("#feesestnewtx").attr('est','');
    } else {
      $("#transactionCreateStatus").removeClass("hidden").html("One or more input or output is invalid").fadeOut().fadeIn();
    }
  });

  $("#verifyBtnLoki").click(function(){
    $(".verifyData").addClass("hidden");
    $("#verifyStatus").hide();
    if(!decodeTransactionScript()){
      $("#verifyStatus").removeClass('hidden').fadeOut().fadeIn();
    }
  });

  function decodeTransactionScript(){
		var tx = coinjs.transaction();
		try {
			var decode = tx.deserialize($("#rawTransaction").val());
			$("#verifyTransactionData .transactionVersion").html(decode['version']);
			$("#verifyTransactionData .transactionSize").html(decode.size()+' <i>bytes</i>');
			$("#verifyTransactionData .transactionLockTime").html(decode['lock_time']);
			$("#verifyTransactionData .transactionRBF").hide();
			$("#verifyTransactionData .transactionSegWit").hide();
			if (decode.witness.length>=1) {
				$("#verifyTransactionData .transactionSegWit").show();
			}
			$("#verifyTransactionData").removeClass("hidden");
			$("#verifyTransactionData tbody").html("");

			var h = '';
			$.each(decode.ins, function(i,o){
				var s = decode.extractScriptKey(i);
				h += '<tr>';
				h += '<td><input class="form-control" type="text" value="'+o.outpoint.hash+'" readonly></td>';
				h += '<td class="col-xs-1">'+o.outpoint.index+'</td>';
				h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
				h += '<td class="col-xs-1"> <span class="glyphicon glyphicon-'+((s.signed=='true' || (decode.witness[i] && decode.witness[i].length==2))?'ok':'remove')+'-circle"></span>';
				if(s['type']=='multisig' && s['signatures']>=1){
					h += ' '+s['signatures'];
				}
				h += '</td>';
				h += '<td class="col-xs-1">';
				if(s['type']=='multisig'){
					var script = coinjs.script();
					var rs = script.decodeRedeemScript(s.script);
					h += rs['signaturesRequired']+' of '+rs['pubkeys'].length;
				} else {
					h += '<span class="glyphicon glyphicon-remove-circle"></span>';
				}
				h += '</td>';
				h += '</tr>';

				//debug
				if(parseInt(o.sequence)<(0xFFFFFFFF-1)){
					$("#verifyTransactionData .transactionRBF").show();
				}
			});

			$(h).appendTo("#verifyTransactionData .ins tbody");

			h = '';
			$.each(decode.outs, function(i,o){

				if(o.script.chunks.length==2 && o.script.chunks[0]==106){ // OP_RETURN

					var data = Crypto.util.bytesToHex(o.script.chunks[1]);
					var dataascii = hex2ascii(data);

					if(dataascii.match(/^[\s\d\w]+$/ig)){
						data = dataascii;
					}

					h += '<tr>';
					h += '<td><input type="text" class="form-control" value="(OP_RETURN) '+data+'" readonly></td>';
					h += '<td class="col-xs-1">'+(o.value/100000000).toFixed(8)+'</td>';
					h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
					h += '</tr>';
				} else {

					var addr = '';
					if(o.script.chunks.length==5){
						addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[2]));
					} else {
						var pub = coinjs.pub;
						coinjs.pub = coinjs.multisig;
						addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[1]));
						coinjs.pub = pub;
					}

					h += '<tr>';
					h += '<td><input class="form-control" type="text" value="'+addr+'" readonly></td>';
					h += '<td class="col-xs-1">'+(o.value/100000000).toFixed(8)+'</td>';
					h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
					h += '</tr>';
				}
			});
			$(h).appendTo("#verifyTransactionData .outs tbody");

			$(".verifyLink").attr('href','coinbin.html?verify='+$("#rawTransaction").val());
			return true;
		} catch(e) {
			return false;
		}
	}

  /* function to determine what we are redeeming from */
  function redeemingFrom(string){
    var r = {};
    var decode = coinjs.addressDecode(string);
    if(decode.version == coinjs.pub){ // regular address
      r.addr = string;
      r.from = 'address';
      r.isMultisig = false;
    } else if (decode.version == coinjs.priv){ // wif key
      var a = coinjs.wif2address(string);
      r.addr = a['address'];
      r.from = 'wif';
      r.isMultisig = false;
    } else if (decode.version == coinjs.multisig){ // mulisig address
      r.addr = '';
      r.from = 'multisigAddress';
      r.isMultisig = false;
    } else {
      var script = coinjs.script();
      var decodeRs = script.decodeRedeemScript(string);
      if(decodeRs){ // redeem script
        r.addr = decodeRs['address'];
        r.from = 'redeemScript';
        r.decodedRs = decodeRs;
        r.isMultisig = true; // not quite, may be hodl
      } else { // something else
        r.addr = '';
        r.from = 'other';
        r.isMultisig = false;
      }
    }
    return r;
  }

  /* default function to retreive unspent outputs*/
	function listUnspentDefault(redeem){
		var tx = coinjs.transaction();
		tx.listUnspent(redeem.addr, function(data){
			if(redeem.addr) {
				$("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="'+explorer_addr+redeem.addr+'" target="_blank">'+redeem.addr+'</a>');

				$.each($(data).find("unspent").children(), function(i,o){
					var tx = $(o).find("tx_hash").text();
					var n = $(o).find("tx_output_n").text();
					var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : $(o).find("script").text();
					var amount = (($(o).find("value").text()*1)/100000000).toFixed(8);

					addOutput(tx, n, script, amount);
				});
			}

			$("#redeemFromBtnLoki").html("Load").attr('disabled',false);
			totalInputAmount();

			mediatorPayment(redeem);
		});
	}

  function addOutput(tx, n, script, amount) {
    if(tx){
      if($("#inputs .txId:last").val()!=""){
        $("#inputs .txidAdd").click();
      }

      $("#inputs .row:last input").attr('disabled',true);

      var txid = ((tx).match(/.{1,2}/g).reverse()).join("")+'';

      $("#inputs .txId:last").val(txid);
      $("#inputs .txIdN:last").val(n);
      $("#inputs .txIdAmount:last").val(amount);

      if(script.match(/^00/) && script.length==44){
        s = coinjs.script();
        s.writeBytes(Crypto.util.hexToBytes(script));
        s.writeOp(0);
        s.writeBytes(coinjs.numToBytes((amount*100000000).toFixed(0), 8));
        script = Crypto.util.bytesToHex(s.buffer);
      }

      $("#inputs .txIdScript:last").val(script);
    }
  }

  function totalInputAmount(){
		$("#totalInput").html('0.00');
		$.each($("#inputs .txIdAmount"), function(i,o){
			if(isNaN($(o).val())){
				$(o).parent().addClass('has-error');
			} else {
				$(o).parent().removeClass('has-error');
				var f = 0;
				if(!isNaN($(o).val())){
					f += $(o).val()*1;
				}
				$("#totalInput").html((($("#totalInput").html()*1) + (f*1)).toFixed(8));
			}
		});
    if($("#totalInput").html() > 0) {
      $("#step2").removeClass('hidden');
    }
		totalFee();
    updateRefund();
	}

  function totalFee(){
    var fee = (($("#totalInput").html()*1) - ($("#totalOutput").html()*1)).toFixed(8);
    $("#transactionFee").val((fee>0)?fee:'0.00');
  }

  /* mediator payment code for when you used a public key */
	function mediatorPayment(redeem){

		if(redeem.from=="redeemScript"){

			$('#recipients .row[rel="'+redeem.addr+'"]').parent().remove();

			$.each(redeem.decodedRs.pubkeys, function(i, o){
				$.each($("#mediatorList option"), function(mi, mo){

					var ms = ($(mo).val()).split(";");

					var pubkey = ms[0]; // mediators pubkey
					var fee = ms[2]*1; // fee in a percentage
					var payto = coinjs.pubkey2address(pubkey); // pay to mediators address

					if(o==pubkey){ // matched a mediators pubkey?

						var clone = '<span><div class="row recipients mediator mediator_'+pubkey+'" rel="'+redeem.addr+'">'+$("#recipients .addressAddTo").parent().parent().html()+'</div><br></span>';
						$("#recipients").prepend(clone);

						$("#recipients .mediator_"+pubkey+" .glyphicon-plus:first").removeClass('glyphicon-plus');
						$("#recipients .mediator_"+pubkey+" .address:first").val(payto).attr('disabled', true).attr('readonly',true).attr('title','Medation fee for '+$(mo).html());

						var amount = ((fee*$("#totalInput").html())/100).toFixed(8);
						$("#recipients .mediator_"+pubkey+" .amount:first").attr('disabled',(((amount*1)==0)?false:true)).val(amount).attr('title','Medation fee for '+$(mo).html());
					}
				});
			});

			validateOutputAmount();
		}
	}

  function validateOutputAmount(){
    $("#recipients .amount").unbind('');
    $("#recipients .amount").keyup(function(){
      if(isNaN($(this).val())){
        $(this).parent().addClass('has-error');
      } else {
        $(this).parent().removeClass('has-error');
        var f = 0;
        $.each($("#recipients .amount"),function(i,o){
          if(!isNaN($(o).val())){
            f += $(o).val()*1;
          }
        });
        $("#totalOutput").html((f).toFixed(8));
      }
      totalFee();
    }).keyup();
  }
});
